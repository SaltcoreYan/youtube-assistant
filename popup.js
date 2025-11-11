document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enableToggle');
  const statusText = document.getElementById('status');
  const rateInfo = document.getElementById('rateInfo');

  // 加载保存的状态
  chrome.storage.sync.get(['enabled'], (result) => {
    const isEnabled = result.enabled !== false; // 默认启用
    updateToggleState(isEnabled);
  });

  // 切换开关
  enableToggle.addEventListener('click', () => {
    const isEnabled = !enableToggle.classList.contains('active');
    updateToggleState(isEnabled);
    
    // 保存状态
    chrome.storage.sync.set({ enabled: isEnabled }, () => {
      console.log('状态已保存:', isEnabled);
      
      // 通知content script更新状态
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'toggleConversion', 
            enabled: isEnabled 
          });
        }
      });
    });
  });

  function updateToggleState(isEnabled) {
    if (isEnabled) {
      enableToggle.classList.add('active');
      statusText.textContent = '状态: 已启用';
      statusText.style.color = '#4CAF50';
    } else {
      enableToggle.classList.remove('active');
      statusText.textContent = '状态: 已禁用';
      statusText.style.color = '#999';
    }
  }

  // 从chrome存储中读取汇率和更新时间
  function updateRateDisplay() {
      chrome.storage.local.get(['lastUpdateTime'], (result) => {
          if (result.lastUpdateTime) {
              const updateTime = new Date(result.lastUpdateTime);
              const formattedTime = updateTime.toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
              });
              rateInfo.textContent = `汇率更新时间: ${formattedTime}`;
              rateInfo.style.color = '#4CAF50';
          } else {
              rateInfo.textContent = '汇率更新时间: 正在加载...';
              rateInfo.style.color = '#999';
          }
      });
  }

  // 页面加载时请求更新汇率
  chrome.runtime.sendMessage({ action: 'updateRate' }, (response) => {
      if (response && response.success) {
          console.log('汇率更新成功');
          updateRateDisplay();
      } else {
          console.log('汇率更新失败');
      }
  });

  // 初始显示
  updateRateDisplay();

  // 监听存储变化,实时更新显示
  chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.lastUpdateTime) {
          updateRateDisplay();
      }
  });
});
