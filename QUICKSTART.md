# Quick Start Guide - Claude Usage Tracker Extension

## 🚀 Installation (5 minutes)

### Step 1: Open Extension Page
1. Open Google Chrome or any Chromium-based browser (Edge, Brave, etc.)
2. Go to `chrome://extensions/`

### Step 2: Enable Developer Mode
3. Look for the toggle in the top-right corner labeled "Developer mode"
4. Click it to enable (it should turn blue/highlighted)

### Step 3: Load the Extension
5. Click the "Load unpacked" button that appears
6. Navigate to `/Users/adi/Developer/claude-usage-tracker-extension`
7. Select the folder and click "Open"

### Step 4: Verify Installation
8. The extension should now appear in your extensions list
9. You should see the Claude Usage Tracker icon in your toolbar (top-right)
10. If not visible, click the puzzle icon and pin the extension

## 🎯 First Use

### Step 1: Visit Claude.ai
1. Go to [claude.ai](https://claude.ai)
2. Make sure you're logged in
3. Refresh the page (Cmd+R or Ctrl+R)

### Step 2: Open the Extension
4. Click the Claude Usage Tracker icon in your toolbar
5. The extension will load your usage data

### Step 3: View Your Quotas
You'll see:
- **Your Plan**: Claude Free / Pro / Max / Team
- **5-Hour Session Limit**: Current percentage used
- **7-Day Limit**: Current percentage used
- **Model-Specific Limits**: (if you have access)
- **Reset Times**: When each limit resets

## 🔧 Troubleshooting

### Issue: "Organization ID not found"

**Solution:**
1. Make sure you're logged into [claude.ai](https://claude.ai)
2. Refresh the page (Cmd+R / Ctrl+R)
3. Wait 2-3 seconds for the content script to extract your org ID
4. Click "Try Again" in the extension popup

### Issue: Extension doesn't show in toolbar

**Solution:**
1. Go to `chrome://extensions`
2. Find "Claude Usage Tracker"
3. If you see it, look for the puzzle icon (🧩) in your toolbar
4. Click it and select the Claude Usage Tracker to pin it
5. If you don't see it in the list, try reinstalling

### Issue: Data shows as "stale" or not updating

**Solution:**
1. Click the 🔄 refresh button in the extension popup
2. Check your internet connection
3. Make sure you're still logged into claude.ai
4. The extension automatically updates every 5 minutes

### Issue: "Failed to fetch data" error

**Solution:**
1. Make sure you're logged into [claude.ai](https://claude.ai)
2. Check that you have internet connection
3. Try logging out and back in to claude.ai
4. Close and reopen the extension popup

## 📊 Understanding the Display

### Subscription Tier
Shows your current Claude plan:
- **Claude Free**: Limited quota
- **Claude Pro**: Higher quota limits
- **Claude Max**: Premium tier with very high limits
- **Claude Team**: Organization account

### 5-Hour Session Limit
- Resets every 5 hours
- Separate from daily limits
- Limited to a certain number of tokens per session

### 7-Day Limit
- Resets once per week (usually on a specific day)
- Most relevant for power users
- Applies across all conversations

### Color Indicators
- 🟢 **Green** (0-70%): Safe, plenty of quota left
- 🟡 **Yellow** (70-90%): Caution, approaching limit
- 🔴 **Red** (90%+): Critical, very close to limit

## 🔄 Manual Refresh

Click the 🔄 button anytime to force-refresh your data immediately.

The extension also automatically updates:
- Every 5 minutes in the background
- When you activate a tab with claude.ai
- Every time you open the popup

## 📱 Browser Support

Works perfectly on:
- ✅ Google Chrome
- ✅ Microsoft Edge
- ✅ Brave Browser
- ✅ Opera Browser
- ✅ Any Chromium-based browser

Coming soon:
- ⏳ Firefox

## 🛠️ Developer Features

### Debug Mode
Open Chrome DevTools (F12) and check:
- Background script logs: `chrome://extensions` → Claude Usage Tracker → "Service Worker" → Open DevTools
- Popup logs: Right-click extension icon → "Inspect popup"

### Reload Extension
Go to `chrome://extensions` and click the 🔄 refresh button on the Claude Usage Tracker card

### Check Storage
Open DevTools → Application tab → Extension Cookies/Storage to see cached data

## ❓ FAQ

**Q: Does this extension steal my data?**
A: No! All data stays in your browser. We only read your usage info from claude.ai.

**Q: Can I use this on multiple devices?**
A: Yes! Install it on any Chrome-based browser on any device.

**Q: Will this slow down my browser?**
A: No! It uses minimal resources (< 5MB memory) and only checks for updates every 5 minutes.

**Q: What if Claude.ai changes their API?**
A: We'll update the extension as needed. Keep checking the GitHub repo for updates.

**Q: Can I use this while logged out?**
A: No, you need to be logged into claude.ai for the extension to work.

## 📞 Support

If you encounter issues:

1. **Check the README.md** for more detailed documentation
2. **Try the troubleshooting section** above
3. **Clear your browser cache** for claude.ai
4. **Reinstall the extension** if problems persist
5. **Check browser console** (F12) for error messages

## 🎉 You're All Set!

Your Claude Usage Tracker extension is now ready to use. Click the icon whenever you want to check your current usage limits!

---

**Need Help?** Check the full README.md in the extension folder for more details.
