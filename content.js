console.log('YouTube汇率转换器,开始运行。。。');

// ==================== YouTubeAssistant 类 ====================
class YouTubeAssistant {
  constructor() {
    // 配置项
    this.CONFIG = {
      MAX_RETRY: 10, // 最大重试次数
      BASE_RETRY_DELAY: 2000, // 基础重试延迟（毫秒）
      MAX_RETRY_DELAY: 60000, // 最大重试延迟（毫秒）
      OBSERVER_CONFIG: { childList: true, subtree: false }, // 主聊天区观察配置
      DIALOG_OBSERVER_CONFIG: { childList: true, subtree: true } // 弹窗观察配置（需要深度监听）
    };
    this.conversionEnabled = true; // 转换功能开关
    this.observers = new Map(); // 统一管理所有 MutationObserver 实例
    this.retryCount = 0; // 当前重试次数
    this.init();
  }

  // ==================== 初始化相关 ====================
  
  // 初始化所有功能
  init() {
    this.setupMessageListener(); // 设置消息监听（与插件popup通信）
    this.loadInitialState(); // 加载初始状态（从storage读取开关状态）
    this.setupNavigationListener(); // 监听页面导航变化
    this.startWhenReady(); // 页面准备好后启动监听
    window.addEventListener('beforeunload', () => this.cleanup()); // 页面卸载前清理资源
  }

  // 设置与插件popup的消息通信
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request) => {
      // 处理开关切换消息
      if (request.action === 'toggleConversion') {
        this.conversionEnabled = request.enabled;
        console.log('转换功能已', this.conversionEnabled ? '启用' : '禁用');
        
        // 根据开关状态启动或停止监听
        if (this.conversionEnabled && this.isLivePage()) {
          this.start();
        } else {
          this.cleanup();
        }
      }
    });
  }

  // 从Chrome存储加载初始开关状态
  loadInitialState() {
    chrome.storage.sync.get(['enabled'], (result) => {
      this.conversionEnabled = result.enabled !== false; // 默认启用
      console.log('初始状态:', this.conversionEnabled ? '启用' : '禁用');
    });
  }

  // ==================== 工具函数 ====================
  
  // 判断当前是否在直播页面
  isLivePage() {
    return window.location.pathname === '/watch' && window.location.search.includes('v=');
  }

  // 清理所有观察者实例，释放资源
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    console.log('🧹 已清理所有观察者');
  }

  // 等待指定元素出现在DOM中
  // @param selector - CSS选择器
  // @param context - 搜索上下文（默认为document）
  // @param timeout - 超时时间（毫秒）
  waitForElement(selector, context = document, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // 先尝试直接查找
      const element = context.querySelector(selector);
      if (element) return resolve(element);
      
      // 使用 MutationObserver 监听DOM变化
      const observer = new MutationObserver(() => {
        const el = context.querySelector(selector);
        if (el) {
          observer.disconnect(); // 找到后立即停止监听
          resolve(el);
        }
      });
      
      observer.observe(context, { childList: true, subtree: true });
      
      // 超时处理
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`未找到元素: ${selector}`));
      }, timeout);
    });
  }

  // 计算重试延迟时间（指数退避算法）
  // 延迟时间 = 基础延迟 * 2^重试次数，但不超过最大延迟
  getRetryDelay() {
    const delay = this.CONFIG.BASE_RETRY_DELAY * Math.pow(2, this.retryCount);
    return Math.min(delay, this.CONFIG.MAX_RETRY_DELAY);
  }

  // ==================== 核心监听逻辑 ====================
  
  // 开始监听 Super Chat 消息
  async observeSuperChats() {
    if (!this.conversionEnabled) return; // 功能已禁用，直接返回
    
    try {
      // 1. 等待聊天框 iframe 加载
      const chatFrame = await this.waitForElement('iframe#chatframe');
      const iframeDoc = chatFrame.contentDocument || chatFrame.contentWindow.document;
      
      // 2. 等待聊天消息容器出现
      const itemsContainer = await this.waitForElement(
        'yt-live-chat-item-list-renderer #items',
        iframeDoc
      );
      
      console.log('✅ 开始监听YouTube直播的聊天消息...');
      this.retryCount = 0; // 成功后重置重试计数
      
      // 3. 创建主聊天区观察者（监听新消息）
      this.createObserver('main', itemsContainer, this.CONFIG.OBSERVER_CONFIG);
      
      // 4. 处理页面已存在的消息
      this.processExistingMessages(itemsContainer);
      
      // 5. 创建弹窗观察者（监听Super Chat详情弹窗）
      this.createDialogObserver(iframeDoc);
      
    } catch (error) {
      console.error('❌ 监听失败:', error.message);
      this.scheduleRetry(); // 失败后安排重试
    }
  }

  // 创建 MutationObserver 的统一方法
  // @param key - 观察者的唯一标识
  // @param target - 要观察的DOM节点
  // @param config - 观察配置
  createObserver(key, target, config) {
    // 如果已存在同名观察者，先清理
    if (this.observers.has(key)) {
      this.observers.get(key).disconnect();
    }
    
    // 创建新观察者
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        // 遍历新增的节点
        mutation.addedNodes.forEach(node => {
          // 只处理元素节点（过滤文本节点等）
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.processMessage(node);
          }
        });
      });
    });
    
    observer.observe(target, config);
    this.observers.set(key, observer); // 保存到集合中统一管理
  }

  // 安排重试
  scheduleRetry() {
    // 检查是否达到最大重试次数
    if (this.retryCount >= this.CONFIG.MAX_RETRY) {
      console.log('❌ 达到最大重试次数，停止重试');
      return;
    }
    
    const delay = this.getRetryDelay();
    this.retryCount++;
    console.log(`⏳ 将在 ${delay}ms 后重试 (${this.retryCount}/${this.CONFIG.MAX_RETRY})`);
    setTimeout(() => this.observeSuperChats(), delay);
  }

  // ==================== 消息处理 ====================
  
  // 处理单个消息元素
  // @param element - 消息DOM元素
  processMessage(element) {
    // 定义不同消息类型的处理器
    const handlers = {
      'YT-LIVE-CHAT-PAID-MESSAGE-RENDERER': () => this.convertAmount(element, '#purchase-amount yt-formatted-string'), // Super Chat
      'YT-LIVE-CHAT-PAID-STICKER-RENDERER': () => this.convertAmount(element, '#purchase-amount-chip'), // Super Sticker
      'YT-LIVE-CHAT-MEMBERSHIP-ITEM-RENDERER': () => this.logMembership(element) // 会员消息
    };
    
    const handler = handlers[element.tagName];
    if (handler) {
      try {
        handler();
      } catch (error) {
        console.error('处理消息出错:', error);
      }
    }
  }

  // 转换并显示人民币金额
  // @param element - 消息元素
  // @param selector - 金额元素的选择器
  convertAmount(element, selector) {
    const amountElement = element.querySelector(selector);
    // 如果找不到金额元素，或已经转换过，则跳过
    if (!amountElement || amountElement.textContent.includes('（约')) return;
    
    const originalAmount = amountElement.textContent.trim();
    const convertedAmount = this.convertCurrency(originalAmount);
    
    if (convertedAmount) {
      // 在原金额后追加人民币金额
      amountElement.textContent = `${originalAmount}（约${convertedAmount}）`;
      console.log('💰 转换:', originalAmount, '→', convertedAmount);
    }
  }

  // 记录会员消息（仅日志，不做转换）
  logMembership(element) {
    const subtext = element.querySelector('#header-subtext');
    if (subtext) {
      console.log('👑 会员消息:', subtext.textContent.trim());
    }
  }

  // 处理容器中已存在的所有消息
  processExistingMessages(container) {
    const selectors = [
      'yt-live-chat-paid-message-renderer', // Super Chat
      'yt-live-chat-paid-sticker-renderer', // Super Sticker
      'yt-live-chat-membership-item-renderer' // 会员消息
    ];
    
    // 遍历所有类型的消息并处理
    selectors.forEach(selector => {
      container.querySelectorAll(selector).forEach(el => this.processMessage(el));
    });
  }

  // ==================== 弹窗处理 ====================
  
  // 创建弹窗观察者（Super Chat详情弹窗）
  createDialogObserver(iframeDoc) {
    // 监听整个body，因为弹窗可能动态添加到任何位置
    this.createObserver('dialog', iframeDoc.body, this.CONFIG.DIALOG_OBSERVER_CONFIG);
    
    // 处理已存在的弹窗
    iframeDoc.querySelectorAll('tp-yt-paper-dialog').forEach(dialog => {
      this.processExistingMessages(dialog);
    });
  }

  // ==================== 汇率转换 ====================
  
  // 将外币金额转换为人民币
  // @param money - 原始金额字符串，如 "US$10.00"
  // @returns 转换后的人民币字符串，如 "¥70.50"
  convertCurrency(money) {
    if (!money || typeof money !== 'string') return '';
    
    // 正则匹配：货币代码 + 可选符号 + 数字
    // 例如: "US$10.00", "CA$ 5.50", "€20"
    const match = money.trim().match(/^([A-Za-z]+)\s*[^\w\s]?\s*([\d,]+(?:\.\d{1,2})?)$/);
    if (!match) return '';
    
    const [, currencyCode, amountStr] = match;
    const amount = parseFloat(amountStr.replace(/,/g, '')); // 移除千位分隔符
    
    // 验证金额有效性
    if (isNaN(amount) || amount <= 0) return '';
    
    // 调用外部汇率转换函数（由其他脚本提供）
    const cnyAmount = exchangeRate(currencyCode.toUpperCase(), amount);
    return cnyAmount ? `¥${cnyAmount}` : '';
  }

  // ==================== 启动与导航 ====================
  
  // 启动监听（清理旧观察者并重新开始）
  start() {
    this.cleanup(); // 先清理旧的观察者
    this.retryCount = 0; // 重置重试计数
    this.observeSuperChats(); // 开始监听
  }

  // 页面准备好后启动
  startWhenReady() {
    const tryStart = () => {
      // 只在直播页面且功能启用时启动
      if (this.isLivePage() && this.conversionEnabled) {
        this.start();
      }
    };
    
    // 根据页面加载状态决定何时启动
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryStart);
    } else {
      tryStart(); // 页面已加载完成，立即启动
    }
  }

  // 设置导航监听（YouTube是SPA，需要监听路由变化）
  setupNavigationListener() {
    // 拦截 history API（pushState 和 replaceState）
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    // 重写 pushState，在原功能基础上添加导航处理
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleNavigation();
    };
    
    // 重写 replaceState
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleNavigation();
    };
    
    // 监听浏览器前进/后退按钮
    window.addEventListener('popstate', () => this.handleNavigation());
    
    // 监听YouTube自定义的导航完成事件
    window.addEventListener('yt-navigate-finish', () => this.handleNavigation());
  }

  // 处理页面导航
  handleNavigation() {
    if (this.isLivePage() && this.conversionEnabled) {
      // 导航到直播页面，启动监听
      console.log('🔄 导航到直播页面');
      setTimeout(() => this.start(), 1000); // 延迟1秒等待页面稳定
    } else {
      // 离开直播页面，清理资源
      this.cleanup();
    }
  }
}

// 创建单例实例，自动启动
new YouTubeAssistant();