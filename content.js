// 全局变量控制是否启用转换
let conversionEnabled = true;

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleConversion') {
    conversionEnabled = request.enabled;
    console.log('转换功能已', conversionEnabled ? '启用' : '禁用');
  }
});

// 初始化时加载保存的状态
chrome.storage.sync.get(['enabled'], (result) => {
  conversionEnabled = result.enabled !== false; // 默认启用
  console.log('初始状态:', conversionEnabled ? '启用' : '禁用');
});

// 页面加载完成后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeSuperChats);
} else {
  observeSuperChats();
}

// 监听新增的支付消息
function observeSuperChats() {
    // 判断是否开启了插件。如果没有开启，就一直监听
    if (!conversionEnabled) {
        setTimeout(observeSuperChats, 1000);
        return;
    }

    // YouTube 直播聊天在 iframe 中,需要先找到 iframe
    const chatFrame = document.querySelector('iframe#chatframe');
    
    if (!chatFrame) {
        // console.log('未找到聊天iframe,可能不在直播页面或聊天未加载,5秒后重试...');
        setTimeout(observeSuperChats, 5000);
        return;
    }

    // console.log('找到聊天iframe:', chatFrame);

    // 等待 iframe 加载完成
    if (!chatFrame.contentDocument) {
        // console.log('iframe内容未加载,等待中...');
        chatFrame.addEventListener('load', observeSuperChats);
        return;
    }

    // 在 iframe 的文档中查找聊天应用
    const iframeDoc = chatFrame.contentDocument || chatFrame.contentWindow.document;
    const chatApp = iframeDoc.querySelector('yt-live-chat-app');

    if (!chatApp) {
        // console.log('在iframe中未找到聊天应用容器，5秒后重试...');
        setTimeout(observeSuperChats, 5000);
        return;
    }
    
    // console.log('✅ 找到聊天应用:', chatApp);

    // 直接在 chatApp 下查找消息列表容器 - 不需要 Shadow DOM
    const itemListRenderer = chatApp.querySelector('yt-live-chat-item-list-renderer');
    if (!itemListRenderer) {
        // console.log('未找到消息列表容器，5秒后重试...');
        setTimeout(observeSuperChats, 5000);
        return;
    }

    const itemsContainer = itemListRenderer.querySelector('#items');
    if (!itemsContainer) {
        // console.log('未找到 #items 容器，5秒后重试...');
        setTimeout(observeSuperChats, 5000);
        return;
    }

    // console.log('✅ 开始监听YouTube直播的聊天消息...', itemsContainer);

    // 创建MutationObserver监听DOM变化
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    // 检查是否为支付消息元素 (Super Chat)
                    if (node.tagName === 'YT-LIVE-CHAT-PAID-MESSAGE-RENDERER') {
                        // console.log('🆕 检测到新的 Super Chat 消息');
                        extractSuperChatAmount(node);
                    }
                    // 检查是否为 Super Sticker
                    else if (node.tagName === 'YT-LIVE-CHAT-PAID-STICKER-RENDERER') {
                        // console.log('🆕 检测到新的 Super Sticker 消息');
                        extractSuperStickerAmount(node);
                    }
                    // 检查是否为会员礼物消息
                    else if (node.tagName === 'YT-LIVE-CHAT-MEMBERSHIP-ITEM-RENDERER') {
                        // console.log('🆕 检测到新的会员消息');
                        extractMembershipInfo(node);
                    }
                }
            });
        });
    });

    // 配置并启动观察器
    observer.observe(itemsContainer, {
        childList: true,
        subtree: false  // 只监听直接子元素
    });

    // 处理已存在的消息
    processExistingSuperChats(itemsContainer);

    // 新增：监听弹窗中的支付消息
    observeDialogSuperChats(iframeDoc);
}

// 新增函数：监听弹窗中的支付消息
function observeDialogSuperChats(iframeDoc) {
    // 创建观察器监听弹窗的出现
    const dialogObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && node.tagName === 'TP-YT-PAPER-DIALOG') {
                    // console.log('🔍 检测到弹窗出现');
                    processDialogSuperChats(node);
                    // 监听弹窗内部的变化
                    watchDialogContent(node);
                }
            });
        });
    });

    // 监听 iframe 文档的 body
    dialogObserver.observe(iframeDoc.body, {
        childList: true,
        subtree: true
    });

    // 处理已存在的弹窗
    const existingDialogs = iframeDoc.querySelectorAll('tp-yt-paper-dialog');
    existingDialogs.forEach(dialog => {
        processDialogSuperChats(dialog);
        watchDialogContent(dialog);
    });
}

// 新增函数：处理弹窗中的支付消息
function processDialogSuperChats(dialogElement) {
    const superChatInDialog = dialogElement.querySelectorAll('yt-live-chat-paid-message-renderer');
    // console.log(`弹窗中找到 ${superChatInDialog.length} 条 Super Chat 消息`);
    superChatInDialog.forEach(message => {
        extractSuperChatAmount(message);
    });

    const superStickerInDialog = dialogElement.querySelectorAll('yt-live-chat-paid-sticker-renderer');
    superStickerInDialog.forEach(message => {
        extractSuperStickerAmount(message);
    });
}

// 新增函数：监听弹窗内容的动态变化
function watchDialogContent(dialogElement) {
    const contentObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.tagName === 'YT-LIVE-CHAT-PAID-MESSAGE-RENDERER') {
                        extractSuperChatAmount(node);
                    } else if (node.tagName === 'YT-LIVE-CHAT-PAID-STICKER-RENDERER') {
                        extractSuperStickerAmount(node);
                    }
                }
            });
        });
    });

    contentObserver.observe(dialogElement, {
        childList: true,
        subtree: true
    });
}

// 提取支付金额的函数 (Super Chat)
function extractSuperChatAmount(messageElement) {
  try {
    const cardDiv = messageElement.querySelector('#card');
    if (!cardDiv) {
      console.log('未找到 #card 元素');
      return null;
    }

    const purchaseAmount = cardDiv.querySelector('#purchase-amount');
    if (!purchaseAmount) {
      console.log('未找到 #purchase-amount 元素');
      return null;
    }

    const formattedString = purchaseAmount.querySelector('yt-formatted-string');
    if (!formattedString) {
      console.log('未找到 yt-formatted-string 元素');
      return null;
    }

    const amount = formattedString.textContent.trim();
    console.log('💰 Super Chat 金额:', amount);
    
    if (!formattedString.textContent.includes('（约')) {
      const renminbi = handleRate(amount);

      if (renminbi) {
        formattedString.textContent = amount + '（约'+renminbi+'）';
      }
    }
    
    return amount;
  } catch (error) {
    console.error('提取金额出错:', error);
    return null;
  }
}

// 提取 Super Sticker 金额
function extractSuperStickerAmount(messageElement) {
  try {
    const purchaseAmountChip = messageElement.querySelector('#purchase-amount-chip');
    if (!purchaseAmountChip) {
      console.log('未找到 Super Sticker 金额元素');
      return null;
    }

    const amount = purchaseAmountChip.textContent.trim();
    console.log('💰 Super Sticker 金额:', amount);

    if (!purchaseAmountChip.textContent.includes('（约')) {
      const renminbi = handleRate(amount);

      if (renminbi) {
        purchaseAmountChip.textContent = amount + '（约'+renminbi+'）';
      }
    }

    return amount;
  } catch (error) {
    console.error('提取 Super Sticker 金额时出错:', error);
    return null;
  }
}

// 提取会员信息
function extractMembershipInfo(messageElement) {
  try {
    const headerSubtext = messageElement.querySelector('#header-subtext');
    if (headerSubtext) {
      const info = headerSubtext.textContent.trim();
      console.log('👑 会员消息:', info);
      return info;
    }
    return null;
  } catch (error) {
    console.error('提取会员信息时出错:', error);
    return null;
  }
}

// 处理已存在的支付消息
function processExistingSuperChats(container) {
  if (!container) {
    console.log('未找到聊天应用容器');
    return;
  }

  // Super Chat 消息
  const superChatMessages = container.querySelectorAll('yt-live-chat-paid-message-renderer');
  console.log(`找到 ${superChatMessages.length} 条 Super Chat 消息`);
  superChatMessages.forEach(message => {
    extractSuperChatAmount(message);
  });

  // Super Sticker 消息
  const superStickerMessages = container.querySelectorAll('yt-live-chat-paid-sticker-renderer');
  console.log(`找到 ${superStickerMessages.length} 条 Super Sticker 消息`);
  superStickerMessages.forEach(message => {
    extractSuperStickerAmount(message);
  });

  // 会员消息
  const membershipMessages = container.querySelectorAll('yt-live-chat-membership-item-renderer');
  console.log(`找到 ${membershipMessages.length} 条会员消息`);
  membershipMessages.forEach(message => {
    extractMembershipInfo(message);
  });
}

// 处理不同货币的金额
function handleRate(money) {
    if (!money || typeof money !== 'string') {
        return '';
    }

    // 定义正则表达式
    const regex = /^([A-Za-z]+)\s*[^\w\s]?\s*([\d,]+(?:\.\d{1,2})?)$/;

    // 清理并匹配字符串
    const match = money.trim().match(regex);
    if (!match) {
        console.log('无法解析金额格式:', money);
        return '';
    }

    // Group 1: 币种代码 (统一转为大写)
    const currencyCode = match[1].toUpperCase();
    
    // Group 2: 原始金额字符串
    const amountStrWithCommas = match[2];

    // 移除千位分隔符 (逗号)
    const cleanedAmountStr = amountStrWithCommas.replace(/,/g, '');

    // 转换为浮点数
    const amount = parseFloat(cleanedAmountStr);

    if (isNaN(amount) || amount <= 0 || !currencyCode) {
        console.warn(`解析后的金额或代码无效: ${money}`);
        return '';
    }
    
    const cnyAmount = exchangeRate(currencyCode, amount);
    if (!cnyAmount) {
        return '转换汇率失败';
    }

    return `¥${cnyAmount}`;
}