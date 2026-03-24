let currentImage = null;
let currentImageFile = null;
let currentLanguage = "en";

let AZURE_ENDPOINT = "";
let AZURE_API_KEY = "";

const CONFIG_API_URL =
  "https://g6sa73wbfraryu4ykqhtzvhi4a0sskbs.lambda-url.ap-northeast-1.on.aws/";

async function fetchConfig() {
  try {
    const response = await fetch(CONFIG_API_URL);
    if (!response.ok) throw new Error("Failed to load configuration");
    const config = await response.json();
    AZURE_ENDPOINT = config.endpoint;
    AZURE_API_KEY = config.apiKey;
    console.log("Configuration loaded successfully");
  } catch (error) {
    console.error("Error loading config:", error);
    showAlert("error", "System configuration failed to load.");
  }
}

function changeLanguage() {
  const lang = document.getElementById("languageSelect").value;
  currentLanguage = lang;
  localStorage.setItem("preferredLanguage", lang);
  const t = translations[lang];

  // Use innerHTML instead of textContent to render icons
  document.getElementById("headerTitle").textContent = t.title;
  document.getElementById("btnCamera").innerHTML = t.btnCamera;
  
  // Update Init Dialog if function exists
  if (typeof updateInitDialogTranslations === 'function') {
    updateInitDialogTranslations();
  }

  document.getElementById("loadingText").innerHTML = t.loadingText;
  document.getElementById("formTitle").innerHTML = t.formTitle;
  document.getElementById("previewText").innerHTML = t.previewText;
  document.getElementById("labelName").innerHTML = t.labelName;
  document.getElementById("labelJobTitle").innerHTML = t.labelJobTitle;
  document.getElementById("labelDepartment").innerHTML = t.labelDepartment;
  document.getElementById("labelPhone").innerHTML = t.labelPhone;
  document.getElementById("labelMobile").innerHTML = t.labelMobile;
  document.getElementById("labelFax").innerHTML = t.labelFax;
  document.getElementById("labelEmail").innerHTML = t.labelEmail;
  document.getElementById("labelCompany").innerHTML = t.labelCompany;
  document.getElementById("labelAddress").innerHTML = t.labelAddress;
  document.getElementById("labelWebsite").innerHTML = t.labelWebsite;
  document.getElementById("labelPotential").innerHTML = t.labelPotential;
  document.getElementById("labelInterestedProducts").innerHTML = t.labelInterestedProducts;
  document.getElementById("potentialInput").options[0].text = t.placeholderPotential;
  document.getElementById("interestedProductsPlaceholder").textContent = t.placeholderSelectProducts;
  document.getElementById("labelNote").innerHTML = t.labelNote;
  document.getElementById("labelTaxId").innerHTML = t.labelTaxId;
  document.getElementById("btnSave").innerHTML = t.btnSave;
  document.getElementById("btnSync").innerHTML = t.btnSync;
  document.getElementById("btnReset").innerHTML = t.btnReset;
  document.getElementById("btnExportLocal").innerHTML = t.btnExportLocal;
  document.getElementById("btnHistory").innerHTML = t.btnHistory;

  // Update Export Button with Count
  //updateExportButton();
  updateUnsyncedBadge();

  // Show/hide Tax ID field based on language
  const taxIdField = document.getElementById("taxIdField");
  if (lang === "tc") {
    taxIdField.style.display = "block";
  } else {
    taxIdField.style.display = "none";
  }

  // Update preview text if no image loaded
  if (!currentImage) {
    const previewBox = document.getElementById("previewBox");
    if (previewBox.querySelector(".preview-placeholder")) {
      previewBox.querySelector("p").textContent = t.previewText;
    }
  }
}

// Helper function to update the Export Button with the count
function updateExportButton() {
  const history = JSON.parse(
    localStorage.getItem("businessCardHistory") || "[]"
  );
  const count = history.length;
  const t = translations[currentLanguage];
  document.getElementById("btnExportLocal").innerHTML = `${t.btnExportLocal} (${count})`;
}

function openCamera() {
  document.getElementById("cameraInput").click();
}

// Prevent triggering file input when clicking on OCR boxes
function triggerFileInput(event) {
  if (event.target.classList.contains("ocr-box")) return;
  
  const fileInput = document.getElementById("fileInput");
  
  // 針對 iOS 裝置嘗試移除 capture 屬性，確保顯示「照片圖庫」選項
  // (iOS 網頁標準限制：通常無法完全跳過選單直接開相簿，但這樣設定是標準作法)
  const isIOS = /iPhone|iPad/i.test(navigator.userAgent);
  if (isIOS) {
    fileInput.removeAttribute("capture");
  }
  
  fileInput.click();
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  currentImageFile = file;

  // Check if file is HEIC/HEIF format
  const isHEIC = /\.(heic|heif)$/i.test(file.name) || 
                 file.type === 'image/heic' || 
                 file.type === 'image/heif';

  if (isHEIC) {
    // Show loading indicator
    showAlert("info", translations[currentLanguage].alertConvertingImage || "Converting HEIC image...");
    
    // Convert HEIC to JPEG
    heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9
    })
    .then(function(convertedBlob) {
      // Create a new File object from the converted blob
      currentImageFile = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg'
      });
      
      // Read the converted file
      const reader = new FileReader();
      reader.onload = function (e) {
        currentImage = e.target.result;
        displayImage(currentImage);
        showAlert("success", translations[currentLanguage].alertImageLoaded);

        // Automatically start OCR after image is loaded
        setTimeout(() => {
          performOCR();
        }, 500);
      };
      reader.readAsDataURL(convertedBlob);
    })
    .catch(function(error) {
      console.error("HEIC conversion error:", error);
      showAlert("error", translations[currentLanguage].alertHEICError || "Failed to convert HEIC image. Please use JPG or PNG format.");
      currentImageFile = null;
    });
  } else {
    // Handle regular image formats
    const reader = new FileReader();
    reader.onload = function (e) {
      currentImage = e.target.result;
      displayImage(currentImage);
      showAlert("success", translations[currentLanguage].alertImageLoaded);

      // Automatically start OCR after image is loaded
      setTimeout(() => {
        performOCR();
      }, 500);
    };
    reader.readAsDataURL(file);
  }
}

function displayImage(imageSrc) {
  const previewBox = document.getElementById("previewBox");
  // Create a relative container for image and overlays
  previewBox.innerHTML = `
        <div id="imageWrapper">
            <img id="previewImage" src="${imageSrc}" alt="Business Card Preview">
            <div id="overlayLayer"></div>
        </div>
      `;
}

async function performOCR() {
  if (!currentImage) {
    showAlert("error", translations[currentLanguage].alertUploadFirst);
    return;
  }

  if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
    showAlert("error", "System configuration not loaded. Retrying...");
    await fetchConfig();
    if (!AZURE_ENDPOINT) return;
  }

  const loadingDiv = document.getElementById("loadingDiv");
  const progressText = document.getElementById("progressText");
  loadingDiv.classList.add("show");
  progressText.textContent = translations[currentLanguage].progressText;

  try {
    // Convert base64 to blob
    const base64Data = currentImage.split(",")[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/jpeg" });

    // Azure Document Intelligence (prebuilt-read) endpoint
    const apiUrl = `${AZURE_ENDPOINT.replace(
      /\/$/,
      ""
    )}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30`;

    // Submit image for analysis
    const submitResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": AZURE_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: blob,
    });

    if (!submitResponse.ok) {
      const errText = await submitResponse.text();
      throw new Error(
        `Azure API error: ${submitResponse.status} ${submitResponse.statusText} - ${errText}`
      );
    }

    // Get operation location from response headers
    const operationLocation = submitResponse.headers.get("Operation-Location");
    if (!operationLocation) {
      throw new Error("No Operation-Location header in response");
    }

    // Poll for results
    let result;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const resultResponse = await fetch(operationLocation, {
        method: "GET",
        headers: {
          "Ocp-Apim-Subscription-Key": AZURE_API_KEY,
        },
      });

      if (!resultResponse.ok) {
        throw new Error(`Failed to get results: ${resultResponse.status}`);
      }

      result = await resultResponse.json();

      if (result.status === "succeeded") {
        break;
      } else if (result.status === "failed") {
        throw new Error("OCR analysis failed");
      }

      attempts++;
      progressText.textContent = `${translations[currentLanguage].progressText} (${attempts}/${maxAttempts})`;
    }

    if (result.status !== "succeeded") {
      throw new Error("OCR timeout");
    }

    // Extract text from results
    let extractedText = "";
    if (result.analyzeResult && result.analyzeResult.pages) {
      for (const page of result.analyzeResult.pages) {
        if (page.lines) {
          for (const line of page.lines) {
            extractedText += line.content + "\n";
          }
        }
      }
    } else if (result.analyzeResult && result.analyzeResult.content) {
      extractedText = result.analyzeResult.content;
    }

    // Draw OCR Overlay
    drawOCROverlay(result);

    parseOCRResult(extractedText);

    loadingDiv.classList.remove("show");
    showAlert("success", translations[currentLanguage].alertScanComplete);
  } catch (error) {
    loadingDiv.classList.remove("show");
    showAlert(
      "error",
      translations[currentLanguage].alertScanFailed + error.message
    );
  }
}

// Function to draw OCR bounding boxes
function drawOCROverlay(result) {
  const overlayLayer = document.getElementById("overlayLayer");
  const img = document.getElementById("previewImage");

  if (!overlayLayer || !img || !result.analyzeResult) return;

  overlayLayer.innerHTML = ""; // Clear existing

  // We need to wait for the image to load to get its display dimensions
  // If image is already loaded:
  if (img.complete) {
    renderBoxes();
  } else {
    img.onload = renderBoxes;
  }

  function renderBoxes() {
    // Azure coordinates are usually based on original image size
    // We need to scale them to the displayed image size
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const displayWidth = img.width;
    const displayHeight = img.height;
    const scaleX = displayWidth / naturalWidth;
    const scaleY = displayHeight / naturalHeight;

    const pages = result.analyzeResult.pages;
    if (!pages) return;

    pages.forEach((page) => {
      if (page.lines) {
        page.lines.forEach((line) => {
          // polygon: [x1, y1, x2, y2, x3, y3, x4, y4]
          // Simple bounding box logic (min x, min y, width, height)
          const p = line.polygon;
          if (!p) return;

          // Calculate bounding box from polygon
          const xs = [p[0], p[2], p[4], p[6]];
          const ys = [p[1], p[3], p[5], p[7]];

          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);

          const box = document.createElement("div");
          box.className = "ocr-box";
          box.style.left = minX * scaleX + "px";
          box.style.top = minY * scaleY + "px";
          box.style.width = (maxX - minX) * scaleX + "px";
          box.style.height = (maxY - minY) * scaleY + "px";

          // Set hover text
          box.setAttribute("data-text", line.content);

           // click to copy functionality
          box.addEventListener("click", async function(event) {
            event.stopPropagation(); // ✅ Prevent event from bubbling up
            const text = this.getAttribute("data-text");
            try {
              await navigator.clipboard.writeText(text);
              // Show success alert
              showAlert("success", text + "\nText copied to clipboard!");
            } catch (err) {        
              console.error("copy error", err);
              showAlert("error", "Copy failed, please select the text manually.");
            }
          });

          box.style.cursor = "pointer";
          overlayLayer.appendChild(box);
        });
      }
    });  

  }
}

function guessName(lines, jobTitleIndex = -1) {
  // 1. 擴充排除關鍵字：包含產業別、公司型態、常見標語
  const excludeKeywords = [
    ...OCR_KEYWORDS.company,
    ...OCR_KEYWORDS.dept,
    ...OCR_KEYWORDS.address,
    ...OCR_KEYWORDS.phone,
    ...OCR_KEYWORDS.mobile,
    ...OCR_KEYWORDS.fax,
    ...OCR_KEYWORDS.email,
    ...OCR_KEYWORDS.website,
    ...OCR_KEYWORDS.taxId,
    ...OCR_KEYWORDS.industry,
  ];

  // 常見職稱 (用於從同一行移除)
  const jobTitles = OCR_KEYWORDS.job;

  // --- 策略 A: 職稱錨點 (Anchor Strategy) ---
  // 如果已知職稱index (jobTitleIndex)，優先檢查該行的上下一行
  if (jobTitleIndex > 0) {
    let prevLine = lines[jobTitleIndex - 1].trim();
    let isBlockedprevLine = excludeKeywords.some((k) =>
      prevLine.toLowerCase().includes(k.toLowerCase())
    );
    let hasNumberprevLine = /\d/.test(prevLine);

    if (
      !isBlockedprevLine &&
      !hasNumberprevLine &&
      prevLine.length >= 2 &&
      !/^[a-z]+$/.test(prevLine) &&
      !/^[A-Z]+$/.test(prevLine) &&
      !excludeKeywords.some((keyword) =>
        prevLine.toLowerCase().includes(keyword.toLowerCase())
      )
    ) {
      return prevLine;
    }
  }

  if (jobTitleIndex >= 2) {
    let prevLine2 = lines[jobTitleIndex - 2].trim();
    let isBlockedprevLine2 = excludeKeywords.some((k) =>
      prevLine2.toLowerCase().includes(k.toLowerCase())
    );
    let hasNumberprevLine2 = /\d/.test(prevLine2);

    if (
      !isBlockedprevLine2 &&
      !hasNumberprevLine2 &&
      prevLine2.length >= 2 &&
      !/^[a-z]+$/.test(prevLine2) &&
      !/^[A-Z]+$/.test(prevLine2) &&
      !excludeKeywords.some((keyword) =>
        prevLine2.toLowerCase().includes(keyword.toLowerCase())
      )
    ) {
      return prevLine2;
    }
  }

  if (jobTitleIndex >= 0 && jobTitleIndex < lines.length - 1) {
    let nextLine = lines[jobTitleIndex + 1].trim();
    let isBlockednextLine = excludeKeywords.some((k) =>
      nextLine.toLowerCase().includes(k.toLowerCase())
    );
    let hasNumbernextLine = /\d/.test(nextLine);

    if (
      !isBlockednextLine &&
      !hasNumbernextLine &&
      nextLine.length >= 2 &&
      !/^[a-z]+$/.test(nextLine) &&
      !/^[A-Z]+$/.test(nextLine) &&
      !excludeKeywords.some((keyword) =>
        nextLine.toLowerCase().includes(keyword.toLowerCase())
      )
    ) {
      return nextLine;
    }
  }

  // --- 策略 B: 全局掃描 (Fallback) ---
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // 過濾 1: 基本雜訊
    if (line.length < 2 || line.includes("@") || /\d/.test(line)) continue;

    // 過濾 2: 關鍵字排除
    if (
      excludeKeywords.some((keyword) =>
        line.toLowerCase().includes(keyword.toLowerCase())
      )
    )
      continue;

    // 過濾 3: 職稱處理 (同一行)
    const matchedTitle = jobTitles.find((title) =>
      line.toLowerCase().includes(title.toLowerCase())
    );
    let possibleName = "";
    if (matchedTitle) {
      possibleName = line.replace(matchedTitle, "").trim();
      possibleName = possibleName.replace(/[\|\-,\.]/g, "").trim(); // 移除標點

      // 嚴格檢查剩餘文字
      if (possibleName.length >= 2 && possibleName.length <= 15) {
        // 如果是中文，長度大於4通常是"XX科技股份有限公司"移除職稱後的殘留
        if (/[\u4e00-\u9fa5]/.test(possibleName) && possibleName.length > 4)
          continue;
        return possibleName;
      }
    }
    if (matchedTitle && possibleName.length == 0) continue;

    // 過濾 4: 純名字猜測 (通常在前10行)
    if (i < 10) {
      // 中文名字嚴格限制 2-4 字
      if (/[\u4e00-\u9fa5]/.test(line)) {
        if (line.length >= 2 && line.length <= 4) return line;
      }
      // 日文（平假名/片假名）或含日本漢字的情況：允許長度小於等於 5
      else if (/[\u3040-\u30ff]/.test(line)) {
        if (line.length >= 2 && line.length <= 5) return line;
      }
      // 韓文（Hangul）：允許長度小於等於 5
      else if (/[\uac00-\ud7af]/.test(line)) {
        if (line.length >= 2 && line.length <= 5) return line;
      }
      // 英文名字 排除全大寫小寫或全是連結符號的
      else {
        if (
          line.length >= 3 &&
          line.length <= 25 &&
          !/^[a-z]+$/.test(line) &&
          !/^[A-Z]+$/.test(line)
        ) {
          return line;
        }
      }
    }
  }
  return "";
}

function extractGlobalPhoneNumber(line) {
  // Regex ：
  // ((\+|00)\d{1,4})?  -> 可選的國碼，如 +886 或 00886
  // [\s\-\.]?          -> 分隔符
  // \(?\d{1,5}\)?      -> 區碼或前綴，可能帶括號 (02)
  // ... 後續的數字群組

  // TW: 0912-345-678, (02) 2792-8000
  // US: 555.123.4567, +1-555-555-5555
  // CN: +86 138 1234 5678
  // DE: +49 30 123456
  // JP: 03-1234-5678

  const globalPhoneRegex =
    /(?:(?:\+|00)\d{1,4}[\s\-\.]*)?(?:\(?\d{1,5}\)?[\s\-\.]*){1,5}\d{3,}/g;

  const matches = line.match(globalPhoneRegex);
  if (!matches) return null;

  // 從匹配結果中找出最像電話號碼的 (長度檢查)
  // 過濾掉太短的 (可能是分機號碼或門牌) 或太長的
  for (let match of matches) {
    // 計算純數字長度
    const digitCount = match.replace(/\D/g, "").length;

    // 國際電話通常至少 8 碼 (包含區碼)，最多約 15 碼 (ITU標準)
    if (digitCount >= 8 && digitCount <= 17) {
      return match.trim();
    }
  }
  return null;
}

function parseOCRResult(text) {
  const lines = text.split("\n").filter((line) => line.trim());

  let name = "";
  let jobTitle = "";
  let department = "";
  let phone = "";
  let mobile = "";
  let fax = "";
  let email = "";
  let company = "";
  let address = "";
  let website = "";
  let taxId = "";

  const keywords = OCR_KEYWORDS;

  let jobTitleIndex = -1;

  // 第一輪掃描：先找明確的欄位 (職稱、電話、Email、公司名)
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    let lineLower = line.toLowerCase();
    
    // TEL
    if (
      keywords.phone.some(
        (k) => line.includes(k) || lineLower.startsWith(k.toLowerCase())
      )
    ) {
      if (!phone) {
        const extracted = extractGlobalPhoneNumber(line);
        if (extracted) {
          phone = extracted;
          continue;
        }
      }
    }
    // Mobile
    if (
      keywords.mobile.some(
        (k) => line.includes(k) || lineLower.startsWith(k.toLowerCase())
      )
    ) {
      if (!mobile) {
        const extracted = extractGlobalPhoneNumber(line);
        if (extracted) {
          mobile = extracted;
          continue;
        }
      }
    }
    // Fax
    if (
      keywords.fax.some(
        (k) => line.includes(k) || lineLower.startsWith(k.toLowerCase())
      )
    ) {
      if (!fax) {
        const extracted = extractGlobalPhoneNumber(line);
        if (extracted) {
          fax = extracted;
          continue;
        }
      }
    }    

    // Website
    const websiteMatch = line.match(
      /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+(?:\/[^\s]*)?/
    );
    if (websiteMatch && !website && !line.includes("@")) {
      website = websiteMatch[0];
      continue;
    }

    // Email
    const emailMatch = line.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    );
    if (emailMatch && !email) {
      email = emailMatch[0];
      continue;
    }

    if (!jobTitle && keywords.job.some((k) => line.includes(k))) {
      jobTitle = line;
      jobTitleIndex = i;
      continue;
    }
    if (!department && keywords.dept.some((k) => line.includes(k))) {
      department = line;
      continue;
    }

    const isAllCaps = /^[A-Z.,&-]+$/.test(line) && line.length > 3;
    const isAllLowerCase = /^[a-z.,&-]+$/.test(line) && line.length > 3;
    const hasOtherKeywords =  
      keywords.phone.some(k => line.includes(k) || lineLower.startsWith(k.toLowerCase())) ||
      keywords.mobile. some(k => line.includes(k) || lineLower.startsWith(k.toLowerCase())) ||
      keywords.fax.some(k => line.includes(k) || lineLower.startsWith(k.toLowerCase())) ||
      keywords.email.some(k => line.includes(k) || lineLower.startsWith(k.toLowerCase())) ||
      keywords.dept.some(k => line.includes(k));
    const isBrandFormat = /^[A-Z][a-z]+[A-Z]?[a-z]*$/.test(line) && 
                      line.length >= 5 && 
                      line.length <= 20;

    if (keywords.company.some((k) => line.includes(k))) {
      company = line;
      continue;
    } else if (!company && (keywords.industry.some((k) => line.includes(k)))) {
      company = line;
      continue;
    } else if (!company && isAllCaps && !hasOtherKeywords) {
      company = line;
      continue;
    } else if (!company && isAllLowerCase && !hasOtherKeywords) {
      company = line;
      continue;
    } else if (!company && isBrandFormat && !hasOtherKeywords && i < 10) {
      company = line;
      continue;
    }

    if (
      !address &&
      line.length > 10 &&
      keywords.address.some(
        (k) => line.includes(k) || lineLower.startsWith(k.toLowerCase()))
      ) {
      address = line;
      
      if (i + 1 < lines.length) { // 檢查下一行是否為地址延續
        let nextLine = lines[i + 1].trim();

        // 檢查是否包含美國州縮寫
        const hasUSState = /[A-Z]/.test(line) && /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|VI|GU|AS)\b/.test(line);
        // 檢查是否包含美國郵遞區號格式（5碼或9碼）
        const hasUSZip = /\b\d{5}(-\d{4})?\b/.test(line);
        const nextLineIsAddressField = 
          ( keywords.address.some(k => nextLine. includes(k)) || hasUSState || hasUSZip ) &&
          nextLine.length >= 5;
          
          if (nextLineIsAddressField) {
            address += ' ' + nextLine;
            i++; // 跳過下一行
          }
        }

      continue;
    }

    // Tax ID - TW only
    const taxIdMatch = line.match(/\b\d{8}\b/);
    if (taxIdMatch && !taxId) {
      taxId = taxIdMatch[0];
      continue;
    }
  }

  // 第二輪：如果還沒找到名字，利用職稱位置來猜
  if (!name) {
    name = guessName(lines, jobTitleIndex);
  }

  // 填入表單
  document.getElementById("nameInput").value = name;
  document.getElementById("jobTitleInput").value = jobTitle;
  document.getElementById("departmentInput").value = department;
  document.getElementById("phoneInput").value = phone;
  document.getElementById("mobileInput").value = mobile;
  document.getElementById("faxInput").value = fax;
  document.getElementById("emailInput").value = email;
  document.getElementById("companyInput").value = company;
  document.getElementById("addressInput").value = address;
  document.getElementById("websiteInput").value = website;
  document.getElementById("taxIdInput").value = taxId;
}

// Save current form data to localStorage
function saveToLocalStorage() {
  const cardData = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    name: document.getElementById("nameInput").value,
    jobTitle: document.getElementById("jobTitleInput").value,
    department: document.getElementById("departmentInput").value,
    phone: document.getElementById("phoneInput").value,
    mobile: document.getElementById("mobileInput").value,
    fax: document.getElementById("faxInput").value,
    email: document.getElementById("emailInput").value,
    company: document.getElementById("companyInput").value,
    address: document.getElementById("addressInput").value,
    website: document.getElementById("websiteInput").value,
    potential: document.getElementById("potentialInput").value,
    interestedProducts: getInterestedProducts(),
    note: document.getElementById("noteInput").value,
    taxId: document.getElementById("taxIdInput").value,
    username: localStorage.getItem('userRealName') || "",
    office: localStorage.getItem('userOffice') || "",
  };

  // Get existing history or initialize empty array
  let history = JSON.parse(localStorage.getItem("businessCardHistory") || "[]");

  // Add new card to history
  history.push(cardData);

  // Save back to localStorage
  localStorage.setItem("businessCardHistory", JSON.stringify(history));

  console.log("Saved to localStorage:", cardData);
  
  // Update sync badge
  if (window.syncToCloud) {
    window.syncToCloud.updateUnsyncedBadge();
  }
}

function saveCard() {
  // Check if there is any data in the form to save
  const hasData = [
    "nameInput",
    "jobTitleInput",
    "departmentInput",
    "phoneInput",
    "mobileInput",
    "faxInput",
    "emailInput",
    "companyInput",
    "addressInput",
    "websiteInput",
    "noteInput",
    "taxIdInput",
    "userRealName",
    "userOffice",
  ].some((id) => document.getElementById(id).value.trim() !== "");

  if (hasData) {
    saveToLocalStorage();
    showAlert("success", translations[currentLanguage].alertSaved);
    clearAll();

    // Update the export button count
    //updateExportButton();
    updateUnsyncedBadge();

  } else {
    showAlert("error", translations[currentLanguage].alertFillField);
  }
}

function rescan() {
  if (!currentImage) {
    showAlert("error", translations[currentLanguage].alertNoImage);
    return;
  }

  if (confirm(translations[currentLanguage].confirmRescan)) {
    performOCR();
  }
}

function clearAll() {
  currentImage = null;
  currentImageFile = null;
  const t = translations[currentLanguage];
  document.getElementById("previewBox").innerHTML = `
        <div class="preview-placeholder">
          <i class="material-icons">add_a_photo</i>
          <p>${t.previewText}</p>
        </div>
      `;
  document.getElementById("nameInput").value = "";
  document.getElementById("jobTitleInput").value = "";
  document.getElementById("departmentInput").value = "";
  document.getElementById("phoneInput").value = "";
  document.getElementById("mobileInput").value = "";
  document.getElementById("faxInput").value = "";
  document.getElementById("emailInput").value = "";
  document.getElementById("companyInput").value = "";
  document.getElementById("addressInput").value = "";
  document.getElementById("websiteInput").value = "";
  document.getElementById("potentialInput").value = "";
  setInterestedProducts([]);
  document.getElementById("noteInput").value = "";
  document.getElementById("taxIdInput").value = "";
  document.getElementById("fileInput").value = "";
  document.getElementById("cameraInput").value = "";
}

// Updated function to export history from LocalStorage
function exportHistoryToExcel() {
  // Retrieve history from local storage
  const historyJSON = localStorage.getItem("businessCardHistory");
  const history = JSON.parse(historyJSON || "[]");

  if (history.length === 0) {
    showAlert("error", translations[currentLanguage].alertNoHistory);
    return;
  }

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Get column headers based on current language by stripping HTML tags
  const t = translations[currentLanguage];
  const stripHtml = (html) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const headers = [
    stripHtml(t.labelName),
    stripHtml(t.labelJobTitle),
    stripHtml(t.labelDepartment),
    stripHtml(t.labelPhone),
    stripHtml(t.labelMobile),
    stripHtml(t.labelFax),
    stripHtml(t.labelEmail),
    stripHtml(t.labelCompany),
    stripHtml(t.labelAddress),
    stripHtml(t.labelWebsite),
    stripHtml(t.labelNote),
    stripHtml(t.labelTaxId),
    "Potential",
    "Interested Product",
    "User Name",
    "Office",
  ];

  // Map history data to array of arrays
  const dataRows = history.map((item) => [
    item.name,
    item.jobTitle,
    item.department,
    item.phone,
    item.mobile,
    item.fax,
    item.email,
    item.company,
    item.address,
    item.website,
    item.note,
    item.taxId,
    item.potential || '',
    Array.isArray(item.interestedProducts) ? item.interestedProducts.join(', ') : (item.interestedProducts || ''),
    item.username || "",
    item.office || "",
  ]);

  // Create data (Headers + Rows)
  const wsData = [headers, ...dataRows];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = [
    { wch: 15 }, // Name
    { wch: 20 }, // Job Title
    { wch: 20 }, // Department
    { wch: 20 }, // Phone
    { wch: 20 }, // Mobile
    { wch: 20 }, // Fax
    { wch: 30 }, // Email
    { wch: 25 }, // Company
    { wch: 40 }, // Address
    { wch: 30 }, // Website
    { wch: 30 }, // Note
    { wch: 15 }, // Tax ID
    { wch: 20 }, // Potential
    { wch: 40 }, // Interested Products
    { wch: 15 }, // User Name
    { wch: 10 }, // Office
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Card History");

  // Generate filename
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `BusinessCard_History_${timestamp}.xlsx`;

  // Export file
  XLSX.writeFile(wb, filename);

  showAlert(
    "success",
    translations[currentLanguage].alertExcelDownloaded + filename
  );
}


function showAlert(type, message) {
  const alertSuccess = document.getElementById("alertSuccess");
  const alertError = document.getElementById("alertError");

  alertSuccess.classList.remove("show");
  alertError.classList.remove("show");

  // Use innerHTML because message now contains HTML icons
  if (type === "success" || type === "info") {
    alertSuccess.innerHTML = message;
    alertSuccess.classList.add("show");
    setTimeout(() => alertSuccess.classList.remove("show"), type === "info" ? 3000 : 2000);
  } else {
    alertError.innerHTML = message;
    alertError.classList.add("show");
    setTimeout(() => alertError.classList.remove("show"), 5000);
  }
}

function resetApp() {
    if (confirm("All data and user settings will be removed, continue?")) {
      localStorage.clear();
      //alert("Application data has been reset.");
      location.reload();
    }
}

// Initialize button count on load
window.onload = function () {
  // Initialize Dialog
  if (typeof initDialogEventListeners === 'function') initDialogEventListeners();
  if (typeof checkAndShowInitDialog === 'function') checkAndShowInitDialog();

  fetchConfig();
  
  const savedLang = localStorage.getItem("preferredLanguage");
  if (savedLang && translations[savedLang]) {
    document.getElementById("languageSelect").value = savedLang;
    changeLanguage();
  } else {
    //updateExportButton();
    updateUnsyncedBadge();
  }
};


