document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const referrer = params.get('referrer') || '';
  
  document.getElementById('goBack').addEventListener('click', () => {
    // First try going back in history
    chrome.runtime.sendMessage({ action: "GO_BACK" });
    
    // If still on block page after 1 second, redirect to referrer
    setTimeout(() => {
      if (window.location.href.includes('block.html')) {
        if (referrer) {
          window.location.href = referrer;
        } else {
          chrome.tabs.create({ url: 'chrome://newtab' });
        }
      }
    }, 1000);
  });
  
  document.getElementById('allowSite').addEventListener('click', () => {
    if (referrer) {
      try {
        const url = new URL(referrer);
        const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
        
        chrome.runtime.sendMessage({
          action: "ADD_SITE",
          site: hostname
        }, () => {
          window.location.href = referrer;
        });
      } catch (error) {
        console.error("Error allowing site:", error);
      }
    }
  });
});