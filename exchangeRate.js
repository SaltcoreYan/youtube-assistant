let ratesCache = DEFAULT_RATES

// 初始化时从存储加载汇率数据
chrome.storage.local.get(['rates'], (result) => {
    if (result.rates) {
        ratesCache = result.rates;
        console.log('exchangeRate.js: 从存储加载汇率数据');
    }
});

// 监听存储变化,实时更新汇率缓存
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.rates) {
        ratesCache = changes.rates.newValue;
        console.log('exchangeRate.js: 汇率数据已更新');
    }
});

// 汇率转换函数
function exchangeRate(currencyCode, amount) {
    const rate = ratesCache[currencyCode];
    if (!rate) {
        console.log('不支持的货币类型:', currencyCode);
        return null;
    }

    const cnyAmount = (amount / rate).toFixed(2);
    return cnyAmount;
}
