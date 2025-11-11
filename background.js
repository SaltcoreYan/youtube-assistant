// background.js

// 引入其他 JS 文件
importScripts('config.js', 'defaultRate.js');

// 更新汇率数据
async function updateRate() {
    try {
        if (typeof RATE_API_URL !== 'string' || !RATE_API_URL.trim()) {
            throw new Error('RATE_API_URL 未定义');
        }
        
        // 使用汇率 API
        const response = await fetch(RATE_API_URL);
        const result = await response.json();

        if (result && result.code == 200) {

            // 转换为相对于 CNY 的汇率
            ratesCache = result.data.rates;
            lastUpdateTime = result.data.updated_time;

            console.log('查询到的汇率成功', ratesCache, lastUpdateTime);
            
            // 保存到存储
            await chrome.storage.local.set({ 
                rates: ratesCache,
                lastUpdateTime: lastUpdateTime 
            });

            console.log('汇率数据已更新:', lastUpdateTime, ratesCache);

            return true;
        }
        return false;
    } catch (error) {
        console.log('更新汇率失败，还原:', error);

        // 还原 rates
        await chrome.storage.local.set({ 
            rates: DEFAULT_RATES,
            lastUpdateTime: DEFAULT_RATES_UPDATETIME,
        });

        return false;
    }
}

// 监听来自 popup 和 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateRate') {
        updateRate().then(success => {
            sendResponse({ success: success });
        });
        return true; // 保持消息通道开放
    }
});

// 插件安装或更新时自动更新汇率
chrome.runtime.onInstalled.addListener(() => {
    console.log('插件已安装/更新,初始化汇率数据...');
    updateRate();
});

// 初始化时从存储加载汇率数据
chrome.storage.local.get(['rates', 'lastUpdateTime'], (result) => {
    if (result.rates) {
        ratesCache = result.rates;
        console.log('从存储加载汇率数据');
    } else {
        // 如果没有缓存,立即更新
        updateRate();
    }
});

// 定期更新汇率 (每小时)
setInterval(() => {
    console.log('定期更新汇率...');
    updateRate();
}, 3600000); // 1小时 = 3600000毫秒