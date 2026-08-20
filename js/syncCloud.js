class syncCloud {
  constructor() {
    // 確保 Firebase 已初始化
    if (!window.firebaseDB || !window.firebaseModules) {
      console.warn('⏳ 等待 Firebase 初始化...');
      this.initWhenReady();
      return;
    }
    
    this.db = window.firebaseDB;
    this.modules = window.firebaseModules;
    this.promptedThresholds = new Set(); // Track which thresholds have been prompted
    this.init();
  }

  // 等待 Firebase 就緒後初始化
  initWhenReady() {
    const checkInterval = setInterval(() => {
      if (window.firebaseDB && window.firebaseModules) {
        clearInterval(checkInterval);
        this.db = window.firebaseDB;
        this.modules = window.firebaseModules;
        this.promptedThresholds = new Set(); // Initialize tracking
        this.init();
      }
    }, 100);
  }

  // 初始化
  init() {
    this.userName = this.getUserIdentity();
    this.exhibitionId = this.getExhibitionId();
    
    //console.log('✅ 雲端同步系統已啟動');
    //console.log('👤 使用者:', this.userName);
    //console.log('📍 展覽:', this.exhibitionId);
    
    // 定期檢查未同步數量
    this.startAutoCheck();
  }

  // ============================================
  // 取得使用者識別
  // ============================================
  getUserIdentity() {
    const setupComplete = localStorage.getItem('userSetupComplete');
    
    const userIdentity = localStorage.getItem('userIdentity');
    const office = localStorage.getItem('userOffice');
    const realName = localStorage.getItem('userRealName');
    
    if (userIdentity) {
      //console.log('✅ 使用者識別:', userIdentity);
      return userIdentity;
    }
    
    console.warn('⚠️ 使用者資料不完整');
    return 'PENDING-SETUP';
  }

  // 取得辦公室
  getUserOffice() {
    return localStorage.getItem('userOffice') || 'Unknown';
  }

  // 取得真實姓名
  getUserRealName() {
    return localStorage.getItem('userRealName') || 'Unknown';
  }

  // 檢查是否已完成設定
  isSetupComplete() {
    return localStorage.getItem('userSetupComplete') === 'true';
  }

  // 取得展覽 ID
  getExhibitionId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlExhibition = urlParams.get('exhibition');
    const savedExhibition = localStorage.getItem('exhibitionId');
    const defaultExhibition = 'exhibition-2026';
    
    const exhibitionId = urlExhibition || savedExhibition || defaultExhibition;
    localStorage.setItem('exhibitionId', exhibitionId);
    
    return exhibitionId;
  }

  // 定期檢查
  startAutoCheck() {
    this.updateUnsyncedBadge();
    setInterval(() => {
        this.updateUnsyncedBadge();
    }, 60000); // Check every 1 minute
  }

  // 更新未同步徽章
  updateUnsyncedBadge() {
    try {
        const historyStr = localStorage.getItem('businessCardHistory');
        
        const history = JSON.parse(historyStr || "[]");

        const unsyncedCount = Array.isArray(history) ? history.filter(c => !c.cloudId && !c.synced).length : 0;
        console.log('🔄 Pending Cloud Sync:', unsyncedCount);
        
        // Update the btnSync text
        const btnSync = document.getElementById('btnSync');
        const t = translations[currentLanguage];
        if (btnSync) {
            btnSync.innerHTML = `${t.btnSync}  (${unsyncedCount})`;
        }

        const btnSyncButton = document.getElementById('btnSyncButton');
          if (btnSyncButton) {
              if (unsyncedCount === 0) {
                  btnSyncButton.disabled = true;
                  btnSyncButton.style.opacity = '0.5';
                  btnSyncButton.style.cursor = 'not-allowed';
              } else {
                  btnSyncButton.disabled = false;
                  btnSyncButton.style.opacity = '1';
                  btnSyncButton.style.cursor = 'pointer';
              }
            }

        // Check if unsynced count matches a threshold and prompt user
        const thresholds = [5, 10, 15, 20, 25, 30];
        if (thresholds.includes(unsyncedCount) && !this.promptedThresholds.has(unsyncedCount)) {
            this.promptedThresholds.add(unsyncedCount);
            const confirmMessage = 
                `📤 You have ${unsyncedCount} unsynced business cards!\n\n` +
                `Would you like to sync them to the cloud now?`;
            
            if (confirm(confirmMessage)) {
                console.log(`✅ User agreed to sync at threshold ${unsyncedCount}`);
                syncHistoryToCloud();
                // Reset prompted threshold to allow prompting again if more cards are added
                this.promptedThresholds.delete(unsyncedCount);
            } else {
                console.log(`❌ User declined sync at threshold ${unsyncedCount}`);
            }
        }

    } catch(e) {
        console.error('Badge update error:', e);
    }
  }
}

// Instantiate the helper
window.syncToCloud = new syncCloud();

async function syncHistoryToCloud() {

  const btnSyncButton = document.getElementById('btnSyncButton');

  if (btnSyncButton) {
    btnSyncButton.disabled = true;
    btnSyncButton.style.opacity = '0.5';
    btnSyncButton.innerHTML = '<i class="material-icons">cloud_upload</i> Syncing...';
  }

  if (!window.firebaseDB || !window.firebaseModules) {
    alert('❌ Firebase not initialized\n\nPlease check network connection.');
    return {
      success: false,
      error: 'FIREBASE_NOT_INITIALIZED'
    };
  }  

  let history = [];
  try {
    const historyStr = localStorage.getItem('businessCardHistory');
    if (!historyStr) {
      alert('✅ No data to sync');
      return {
        success: true,
        total: 0,
        message: 'No data'
      };
    }
    
    history = JSON.parse(historyStr);
    
    if (!Array.isArray(history) || history.length === 0) {
      alert('✅ No data to sync');
      return {
        success: true,
        total: 0,
        message: 'No data'
      };
    }
  } catch (error) {
    console.error('❌ Failed to read history data:', error);
    alert('❌ Failed to read local data');
    return {
      success: false,
      error: 'READ_ERROR'
    };
  }
  
  console.log(`📊 讀取到 ${history.length} 筆歷史資料`);
  
  // ============================================
  // 3. 篩選未同步的資料
  // ============================================
  
  const unsyncedCards = history.filter(card => {
    // 檢查是否已有 cloudId 或 synced 標記
    return !card.cloudId && !card.synced;
  });
  
  if (unsyncedCards.length === 0) {
    alert('✅ All data is already synced!');
    return {
      success: true,
      total: history.length,
      synced: history.length,
      unsynced: 0,
      message: 'All data is already synced'
    };
  }
  
  console.log(`📤 發現 ${unsyncedCards.length} 筆未同步資料`);
  
  // ============================================
  // 4. 確認對話框
  // ============================================
  
  const userInfo = window.syncToCloud;
  /*
  const confirmMessage = 
    `📤 Ready to sync to Firebase\n\n` +
    `Pending: ${unsyncedCards.length} cards\n` +
    `Synced: ${history.length - unsyncedCards.length} cards\n` +
    `Total: ${history.length} cards\n\n` +
    `User: ${userInfo.userName}\n` +
    `Office: ${userInfo.getUserOffice()}\n` +
    `Exhibition: ${userInfo.exhibitionId}\n\n` +
    `Are you sure you want to start syncing?`;
  
  if (!confirm(confirmMessage)) {
    console.log('❌ User cancelled sync');
    return {
      success: false,
      cancelled: true,
      message: 'User cancelled'
    };
  }*/
  
  // ============================================
  // 5. 開始批次上傳
  // ============================================
  
  const loadingDiv = document.getElementById("loadingDiv");
  if (loadingDiv) {
      loadingDiv.classList.add("show");
  }
  
  let successCount = 0;
  let failCount = 0;
  const failedCards = [];
  const startTime = Date.now();
  
  console.log('🚀 開始批次上傳...');
  
  for (let i = 0; i < unsyncedCards.length; i++) {
    const card = unsyncedCards[i];
    const cardIndex = i + 1;
    
    try {
      // 更新進度顯示
      if (window.updateSyncProgress) {
        updateSyncProgress(cardIndex, unsyncedCards.length);
      }
      
      // 更新 Loading 文字
      if (window.showLoading) {
        showLoading(`Syncing ${cardIndex}/${unsyncedCards.length}... `);
      }
      
      console.log(`📤 [${cardIndex}/${unsyncedCards.length}] 上傳: `, card.name || card.company || card.email);
      
      // 準備上傳資料（與 exportHistoryToExcel 類似的資料結構）
      const uploadData = {

        name:  card.name || '',
        companyName: card.company || card.companyName || '',              // 🆕 改名
        companyAddress: card.address || card.companyAddress || '',        // 🆕 改名
        companyWebsite: card.website || card.companyWebsite || '', 
        jobTitle: card.jobTitle || '',
        department: card.department || '',
        phone: card.phone || '',
        mobile: card.mobile || '',
        fax: card.fax || '',
        email: card.email || '',
        taxId: card.taxId || '',
        note: card.note || '',
        potential: card.potential || '',
        interestedProducts: Array.isArray(card.interestedProducts)
          ? card.interestedProducts
          : (typeof card.interestedProducts === 'string' && card.interestedProducts
              ? card.interestedProducts.split(',').map(s => s.trim()).filter(Boolean)
              : []),

        scannedBy: userInfo.getUserRealName(),
        scannedByOffice: userInfo.getUserOffice(),
        exhibitionId: userInfo.exhibitionId,
        scannedAt: window.firebaseModules.serverTimestamp(),        

      };     
      
      // 上傳到 Firestore
      const docRef = await window.firebaseModules.addDoc(
        window.firebaseModules.collection(window.firebaseDB, 'exhibition_cards'),
        uploadData
      );      
      console.log(`  ✅ 成功，雲端 ID: ${docRef.id}`);
      
      // 標記為已同步
      card.cloudId = docRef.id;
      card.synced = true;
      card.syncedAt = Date.now();
      
      successCount++;
      
      // 避免請求過快，稍微延遲
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`  ❌ 失敗: `, error.message);
      
      failCount++;
      failedCards.push({
        card: card,
        error: error.message
      });
    }
  }
  
  // ============================================
  // 6. 更新 localStorage（保存同步狀態）
  // ============================================
  
  try {
    localStorage.setItem('businessCardHistory', JSON.stringify(history));
    console.log('✅ 已更新本地同步狀態');
  } catch (error) {
    console.error('⚠️ 更新本地狀態失敗:', error);
  }
  
  // ============================================
  // 7. 計算統計資訊
  // ============================================
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  const result = {
    success: true,
    total: unsyncedCards.length,
    successCount,
    failCount,
    failedCards,
    duration,
    message: `Sync complete: ${successCount} success, ${failCount} failed (Duration: ${duration}s)`
  };
  
  console.log('📊 同步結果:', result);
  
  // ============================================
  // 8. 隱藏 Loading 並顯示結果
  // ============================================
  
  
    if (loadingDiv) {
      loadingDiv.classList.remove("show");
    }
  
  // 顯示結果對話框
  const resultMessage = 
    `✅ Sync Complete!\n\n` +
    `Success: ${successCount} cards\n` +
    `Failed: ${failCount} cards\n` +
    `Total: ${unsyncedCards.length} cards\n` +
    `Duration: ${duration}s\n\n` +
    (failCount > 0 ? 
      `⚠️ Some data failed to sync. Please check network and try again.` : 
      `🎉 All data successfully synced to Cloud!`);
  
  alert(resultMessage);
  
  // 如果有失敗的，輸出到 Console
  if (failedCards.length > 0) {
    console.error('❌ 失敗的名片:', failedCards);
  }
  
  // ============================================
  // 9. 更新 UI 顯示
  // ============================================
  
  if (window.syncToCloud) {
    window.syncToCloud.updateUnsyncedBadge();
  }

  if (btnSyncButton) {
      btnSyncButton.disabled = false;
      btnSyncButton.style.opacity = '1';
      btnSyncButton.innerHTML = '<i class="material-icons">cloud_upload</i> Sync to Cloud';
    }
  
  return result;
}
