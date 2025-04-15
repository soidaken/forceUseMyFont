// Global translations cache
let currentTranslations = null;

// Load translations for a specific language
async function loadTranslations(lang) {
  return new Promise((resolve, reject) => {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    console.log('Loading translations from:', url);
    
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(translations => {
        // console.log('Loaded translations for', lang, ':', translations);
        resolve(translations);
      })
      .catch(error => {
        console.error('Error loading translations for', lang, ':', error);
        // Fallback to English if loading fails
        if (lang !== 'en') {
          loadTranslations('en').then(resolve).catch(reject);
        } else {
          reject(error);
        }
      });
  });
}

// Get translation for a specific message
function getMessage(messageName) {
  if (!currentTranslations) {
    console.warn('Translations not loaded yet');
    return '';
  }
  return currentTranslations[messageName]?.message || '';
}

// Retrieve stored domains and fonts when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Initialize language first
  initializeI18n();
  // Then load other components
  loadDomains();
  loadFonts();
  setupFontDragDrop();
  
  // Set up language button click handlers
  setupLanguageButtons();
});

// Language detection and handling
async function initializeI18n() {
  // Get the user's language preference from storage
  chrome.storage.sync.get({language: null}, async function(result) {
    let language = result.language;
    
    // If no language set, detect from browser
    if (!language) {
      language = detectLanguage();
      // Save detected language
      chrome.storage.sync.set({language: language}, function() {
        console.log('Initial language set to:', language);
      });
    }
    
    console.log('Current language:', language);
    
    // Load translations for the current language
    currentTranslations = await loadTranslations(language);
    
    // Set html lang attribute
    document.documentElement.setAttribute('lang', language);
    
    // Mark the current language button as active
    document.querySelectorAll('.lang-btn').forEach(btn => {
      if (btn.dataset.lang === language) {
        btn.classList.add('active');
        console.log('Activated language button:', language);
      } else {
        btn.classList.remove('active');
      }
    });
    
    // Apply translations
    applyTranslations();
  });
}

// Detect user's language
function detectLanguage() {
  // Get browser language (e.g., "en-US", "zh-CN")
  const browserLang = navigator.language.toLowerCase();
  
  // List of supported languages
  const supportedLangs = ['zh', 'en', 'ja', 'ko', 'vi', 'de', 'fr', 'ru', 'th', 'es', 'it'];
  
  // First try exact match
  if (supportedLangs.includes(browserLang)) {
    return browserLang;
  }
  
  // Then try language code without region
  const langCode = browserLang.split('-')[0];
  if (supportedLangs.includes(langCode)) {
    return langCode;
  }
  
  // Special handling for Chinese
  if (langCode === 'zh') {
    // Use zh-HK for traditional Chinese regions
    if (['hk', 'tw', 'mo'].includes(browserLang.split('-')[1])) {
      return 'zh-HK';
    }
    // Use zh for simplified Chinese
    return 'zh';
  }
  
  // Default to English if no match
  return 'en';
}

// Apply translations to all elements
function applyTranslations() {
  const updateElement = (element, messageName) => {
    const translation = getMessage(messageName);
    // console.log('Translation for', messageName, ':', translation);
    if (translation) {
      if (element.tagName.toLowerCase() === 'input') {
        element.placeholder = translation;
      } else {
        element.textContent = translation;
      }
    }
  };

  // Update all elements with i18n_ prefix
  document.querySelectorAll('[id^="i18n_"]').forEach(element => {
    const messageName = element.id.replace('i18n_', '');
    updateElement(element, messageName);
  });

  // Update input fields and buttons
  const elements = {
    'customFontInput': 'font_placeholder',
    'domainInput': 'whitelist_placeholder',
    'addCustomFont': 'font_use_button',
    'addDomain': 'whitelist_button',
    'resetToSystemFont': 'reset_button'
  };

  for (const [elementId, messageName] of Object.entries(elements)) {
    const element = document.getElementById(elementId);
    if (element) {
      updateElement(element, messageName);
    }

  // 设置页面标题
  document.title = getMessage('extension_name');
  }

  // Update drag hint
  const dragHint = document.querySelector('.drag-hint');
  if (dragHint) {
    updateElement(dragHint, 'font_drop_hint');
  }

  // Update empty whitelist message
  const emptyList = document.querySelector('.empty-list');
  if (emptyList) {
    updateElement(emptyList, 'empty_whitelist');
  }

  // Update remove buttons
  document.querySelectorAll('.remove-domain').forEach(button => {
    updateElement(button, 'remove_domain');
  });
}

// Add this after your document ready event handler
document.getElementById('resetToSystemFont').addEventListener('click', resetToSystemFont);

// Function to reset to system font
function resetToSystemFont() {
  const confirmMessage = getMessage('reset_confirm');
  if (confirm(confirmMessage)) {
    // Clear the font preference entirely instead of setting to a system font
    chrome.storage.sync.set({
      selectedFont: null,  // Set to null instead of a system font
      recentFonts: []     // Clear font history too
    }, function() {
      // Clear the font tags container
      document.getElementById('fontTags').innerHTML = '';
      
      // Clear the input field
      document.getElementById('customFontInput').value = '';
      
      // Show success message in the FIRST card's alert div
      const resetCard = document.querySelector('.card:first-child');
      const container = resetCard.querySelector('.alert');
      const originalText = container.textContent;
      container.textContent = getMessage('reset_success');
      container.style.backgroundColor = '#d4edda';
      container.style.color = '#155724';
      container.style.borderLeftColor = '#28a745';
      
      // Restore original message after 5 seconds
      setTimeout(() => {
        container.textContent = originalText;
        container.style.backgroundColor = '#fff3cd';
        container.style.color = '#856404';
        container.style.borderLeftColor = '#ffc107';
      }, 5000);
    });
  }
}

// Add domain button handler
document.getElementById('addDomain').addEventListener('click', addDomain);

// Font button handler
document.getElementById('addCustomFont').addEventListener('click', useFont);

// Input field event listeners for Enter key
document.getElementById('domainInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    addDomain();
  }
});

document.getElementById('customFontInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    useFont();
  }
});

// Set up drag and drop for font files
function setupFontDragDrop() {
  const inputElement = document.getElementById('customFontInput');
  const wrapper = inputElement.parentElement;
  
  // Prevent default behavior to enable drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    inputElement.addEventListener(eventName, preventDefaults, false);
    wrapper.addEventListener(eventName, preventDefaults, false);
  });
  
  // Show/hide drag UI feedback
  ['dragenter', 'dragover'].forEach(eventName => {
    inputElement.addEventListener(eventName, () => {
      wrapper.classList.add('drag-active');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    inputElement.addEventListener(eventName, () => {
      wrapper.classList.remove('drag-active');
    }, false);
  });
  
  // Handle dropped font files
  inputElement.addEventListener('drop', handleFontDrop, false);
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
// Direct TTF/OTF Parser for Font Family Name
function parseFontFile(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  let offset = 0;
  
  // Read the font version/sfnt version
  const sfntVersion = view.getUint32(offset);
  offset += 4;
  
  // Read the number of tables
  const numTables = view.getUint16(offset);
  offset += 2;
  
  // Skip searchRange, entrySelector, and rangeShift
  offset += 6;
  
  // Find the 'name' table
  let nameTableOffset = 0;
  let nameTableLength = 0;
  
  for (let i = 0; i < numTables; i++) {
    // Read table tag as 4 bytes
    const tag = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    offset += 4;
    
    // Skip checksum
    offset += 4;
    
    // Read offset and length
    const tableOffset = view.getUint32(offset);
    offset += 4;
    const tableLength = view.getUint32(offset);
    offset += 4;
    
    // If this is the 'name' table, save its offset and length
    if (tag === 'name') {
      nameTableOffset = tableOffset;
      nameTableLength = tableLength;
      break;
    }
  }
  
  if (nameTableOffset === 0) {
    throw new Error("No 'name' table found in font file");
  }
  
  // Parse the name table
  offset = nameTableOffset;
  
  // Format of name table
  const format = view.getUint16(offset);
  offset += 2;
  
  // Count of name records
  const count = view.getUint16(offset);
  offset += 2;
  
  // Offset to start of string storage
  const stringOffset = nameTableOffset + view.getUint16(offset);
  offset += 2;
  
  // Find name ID 1 (Font Family Name)
  let familyName = null;
  
  for (let i = 0; i < count; i++) {
    const platformID = view.getUint16(offset);
    offset += 2;
    const encodingID = view.getUint16(offset);
    offset += 2;
    const languageID = view.getUint16(offset);
    offset += 2;
    const nameID = view.getUint16(offset);
    offset += 2;
    const length = view.getUint16(offset);
    offset += 2;
    const stringOffset_ = view.getUint16(offset) + stringOffset;
    offset += 2;
    
    // We want name ID 1 (Font Family Name)
    if (nameID === 1) {
      // Prefer English language if available
      if (familyName === null || 
          // Windows platform with English US (1033)
          (platformID === 3 && languageID === 1033) ||
          // Mac platform with English (0)
          (platformID === 1 && languageID === 0)) {
        
        // Decode the string
        let fontName = '';
        if (platformID === 3) { // Windows, UTF-16BE
          for (let j = 0; j < length; j += 2) {
            const charCode = view.getUint16(stringOffset_ + j);
            fontName += String.fromCharCode(charCode);
          }
        } else { // Mac, ASCII or other
          for (let j = 0; j < length; j++) {
            const charCode = view.getUint8(stringOffset_ + j);
            fontName += String.fromCharCode(charCode);
          }
        }
        
        familyName = fontName;
        
        // If we found Windows/English, we can stop
        if (platformID === 3 && languageID === 1033) {
          break;
        }
      }
    }
  }
  
  return familyName;
}

// Now integrate this into our font drop handler
function handleFontDrop(e) {
  const file = e.dataTransfer.files[0];
  const inputElement = document.getElementById('customFontInput');
  
  if (!file) return;
  
  // Check if it's a font file
  const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!validExtensions.includes(extension)) {
    alert(getMessage('drag_font_file')+' (.ttf, .otf, .woff, .woff2)');
    return;
  }
  
  // Show loading state
  inputElement.value = getMessage('reading_font_info');
  inputElement.disabled = true;
  
  // Read the font file as ArrayBuffer for binary parsing
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      // Parse the font file
      const fontFamilyName = parseFontFile(event.target.result);
      
      if (fontFamilyName) {
        inputElement.value = fontFamilyName;
        
        // Give visual feedback
        inputElement.style.backgroundColor = '#e8f0fe';
        setTimeout(() => {
          inputElement.style.backgroundColor = '';
        }, 1000);
      } else {
        // Fallback to filename
        fallbackToFilename();
      }
    } catch (err) {
      console.error("Error parsing font:", err);
      fallbackToFilename();
    } finally {
      inputElement.disabled = false;
    }
  };
  
  reader.onerror = function() {
    console.error("Error reading file");
    inputElement.value = "";
    inputElement.disabled = false;
    showErrorAlert(getMessage('file_read_error'));
  };
  
  // Helper for filename fallback
  function fallbackToFilename() {
    const fontName = formatFilenameAsFont(file.name);
    inputElement.value = fontName;
    inputElement.select();
    showErrorAlert(getMessage('font_name_read_error'));
  }
  
  // Helper to format filename as font name
  function formatFilenameAsFont(filename) {
    let fontName = filename.replace(/\.[^/.]+$/, ""); // Remove extension
    
    // Replace common font file naming patterns
    fontName = fontName
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1') // Add spaces before capital letters
      .replace(/\s+/g, ' ')       // Normalize spaces
      .trim();
    
    // Make first letter of each word uppercase
    fontName = fontName.replace(/\w\S*/g, function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1);
    });
    
    return fontName;
  }
  
  // Start reading the font file
  reader.readAsArrayBuffer(file);
}

}


// Helper function to show error alerts with specific target
function showErrorAlert(message, cardIndex = 1) {  // Default to second card (index 1)
  const card = document.querySelector(`.card:nth-child(${cardIndex + 1})`);
  const container = card.querySelector('.alert');
  const originalText = container.textContent;
  
  container.textContent = message;
  container.style.backgroundColor = '#f8d7da';
  container.style.color = '#721c24';
  container.style.borderLeftColor = '#f5c6cb';
  
  // Restore original message after 3 seconds
  setTimeout(() => {
    container.textContent = originalText;
    container.style.backgroundColor = '#fff3cd';
    container.style.color = '#856404';
    container.style.borderLeftColor = '#ffc107';
  }, 3000);
}

// Add this function to options.js
function detectSystemFont() {
  // Create a temporary span element
  const span = document.createElement('span');
  span.innerText = 'Font Detection';
  span.style.visibility = 'hidden';
  document.body.appendChild(span);
  
  // Get computed font family
  const computedStyle = window.getComputedStyle(span);
  let fontFamily = computedStyle.fontFamily;
  
  // Clean up
  document.body.removeChild(span);
  
  // Parse the font family string
  // It might return something like: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI'"
  // Try to extract the first concrete font
  const fonts = fontFamily.split(',');
  let detectedFont = '';
  
  for (const font of fonts) {
    const cleaned = font.trim().replace(/["']/g, '');
    // Skip generic families and system fonts
    if (!['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 
         '-apple-system', 'BlinkMacSystemFont'].includes(cleaned)) {
      detectedFont = cleaned;
      break;
    }
  }
  
  // If we couldn't detect anything specific, use a reasonable default
  return detectedFont || 'Arial';
}

// Modify loadFonts function
function loadFonts() {
  chrome.storage.sync.get({
    selectedFont: null,  // Default to null
    recentFonts: []
  }, function(result) {
    // If no font is selected (first time), just leave the UI empty
    if (!result.selectedFont) {
      // No detection, no tags - clean first-run state
      return;
    } else {
      // Normal case - not first time
      const fontTagsContainer = document.getElementById('fontTags');
      fontTagsContainer.innerHTML = '';
      
      // Create tag for each font in history
      result.recentFonts.forEach(font => {
        createFontTag(font, font === result.selectedFont);
      });
      
      // Set input value
      document.getElementById('customFontInput').value = result.selectedFont;
    }
  });
}


// Create a font tag element
function createFontTag(fontName, isActive = false) {
  const fontTagsContainer = document.getElementById('fontTags');
  
  // Check if tag already exists
  const existingTag = Array.from(fontTagsContainer.children).find(
    tag => tag.dataset.font === fontName
  );
  
  if (existingTag) {
    // Just set active state if it already exists
    if (isActive) {
      Array.from(fontTagsContainer.children).forEach(tag => 
        tag.classList.remove('active')
      );
      existingTag.classList.add('active');
    }
    return;
  }
  
  // Create new tag
  const tagElement = document.createElement('div');
  tagElement.className = 'font-tag' + (isActive ? ' active' : '');
  tagElement.dataset.font = fontName;
  
  // Use the font itself to show the name if possible
  tagElement.innerHTML = `
    <span style="font-family: '${fontName}';">${fontName}</span>
    <span class="font-tag-remove">×</span>
  `;
  
  // Click handler for the tag
  tagElement.addEventListener('click', function(e) {
    // Ignore if clicking on the remove button
    if (e.target.classList.contains('font-tag-remove')) return;
    
    document.getElementById('customFontInput').value = fontName;
    useFont();
  });
  
  // Click handler for remove button
  tagElement.querySelector('.font-tag-remove').addEventListener('click', function(e) {
    e.stopPropagation();
    removeFontTag(fontName);
  });
  
  fontTagsContainer.appendChild(tagElement);
}

// Remove a font tag
function removeFontTag(fontName) {
  chrome.storage.sync.get({recentFonts: []}, function(result) {
    // Remove from storage
    const updatedFonts = result.recentFonts.filter(font => font !== fontName);
    
    chrome.storage.sync.set({recentFonts: updatedFonts}, function() {
      // Remove from UI
      const tagToRemove = document.querySelector(`.font-tag[data-font="${fontName}"]`);
      if (tagToRemove) {
        tagToRemove.remove();
      }
      
      // If we removed the active font, set a new one
      chrome.storage.sync.get({selectedFont: 'Maple Mono NL NF CN'}, function(data) {
        if (data.selectedFont === fontName && updatedFonts.length > 0) {
          // Select the first available font
          chrome.storage.sync.set({selectedFont: updatedFonts[0]});
          document.getElementById('customFontInput').value = updatedFonts[0];
        } else if (updatedFonts.length === 0) {
          // If no fonts left, clear the input and use system default
          chrome.storage.sync.set({selectedFont: null});
          document.getElementById('customFontInput').value = '';
          document.getElementById('customFontInput').placeholder = getMessage('font_placeholder');
        }
      });
    });
  });
}

// Function to use the selected font
function useFont() {
  const customFontInput = document.getElementById('customFontInput');
  const fontName = customFontInput.value.trim();
  
  if (!fontName) {
    alert(getMessage('invalid_font_name'));
    return;
  }
  
  // Save the selected font
  chrome.storage.sync.set({selectedFont: fontName}, function() {
    // Add to recent fonts if not already there
    chrome.storage.sync.get({recentFonts: []}, function(result) {
      let recentFonts = result.recentFonts;
      
      // Remove if it exists (to move it to the front)
      recentFonts = recentFonts.filter(font => font !== fontName);
      
      // Add to the front of the array
      recentFonts.unshift(fontName);
      
      // Keep only the last 10 fonts
      if (recentFonts.length > 10) {
        recentFonts = recentFonts.slice(0, 10);
      }
      
      chrome.storage.sync.set({recentFonts: recentFonts}, function() {
        // Refresh font tags
        loadFonts();
        
        // Show success message in the FONT SELECTION card specifically
        const fontCard = document.querySelector('.card:nth-child(2)');
        const container = fontCard.querySelector('.alert');
        const originalText = container.textContent;
        container.textContent = getMessage('save_success');
        container.style.backgroundColor = '#d4edda';
        container.style.color = '#155724';
        container.style.borderLeftColor = '#28a745';

        // Restore original message after 5 seconds
        setTimeout(() => {
          container.textContent = originalText;
          container.style.backgroundColor = '#fff3cd';
          container.style.color = '#856404';
          container.style.borderLeftColor = '#ffc107';
        }, 5000);
      });
    });
  });
}
// Function to load domains from storage
function loadDomains() {
  chrome.storage.sync.get({whitelistDomains: []}, function(result) {
    const domainList = document.getElementById('domainList');
    domainList.innerHTML = ''; // Clear existing list
    
    if (result.whitelistDomains.length === 0) {
      domainList.innerHTML = '<div class="empty-list">白名单为空，所有网站都会被应用字体。</div>';
      return;
    }
    
    // Add each domain to the list with a remove button
    result.whitelistDomains.forEach(domain => {
      const domainItem = document.createElement('div');
      domainItem.className = 'domain-item';
      domainItem.innerHTML = `
        <span>${domain}</span>
        <button data-domain="${domain}" class="remove-domain">x</button>
      `;
      domainList.appendChild(domainItem);
    });
    
    // Add event listeners to all remove buttons
    document.querySelectorAll('.remove-domain').forEach(button => {
      button.addEventListener('click', function() {
        removeDomain(this.getAttribute('data-domain'));
      });
    });
  });
}

// Parse URL to extract domain name
function extractDomain(url) {
  // Handle if user enters just a domain
  if (!/^https?:\/\//i.test(url) && !/^www\./i.test(url)) {
    return url.trim().toLowerCase();
  }
  
  try {
    // Create URL object to parse correctly
    if (!/^https?:\/\//i.test(url)) {
      url = 'http://' + url;
    }
    
    const urlObj = new URL(url);
    let domain = urlObj.hostname;
    
    // Remove 'www.' if present
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    return domain;
  } catch (e) {
    console.error("Error parsing URL:", e);
    return url.trim().toLowerCase(); // Return original as fallback
  }
}

// Function to add a new domain
function addDomain() {
  const domainInput = document.getElementById('domainInput');
  let inputValue = domainInput.value.trim();
  
  if (!inputValue) {
    alert(getMessage('invalid_domain'));
    return;
  }
  
  // Extract domain from URL
  const domain = extractDomain(inputValue);
  
  // Simple domain validation
  if (!/^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/.test(domain)) {
    alert(getMessage('invalid_domain_format'));
    return;
  }
  
  // Get current domains, add new one, and save back to storage
  chrome.storage.sync.get({whitelistDomains: []}, function(result) {
    const domains = result.whitelistDomains;
    
    // Check if already exists
    if (domains.includes(domain)) {
      alert(getMessage('domain_in_whitelist'));
      return;
    }
    
    domains.push(domain);
    chrome.storage.sync.set({whitelistDomains: domains}, function() {
      domainInput.value = ''; // Clear input
      loadDomains(); // Refresh list
    });
  });
}

// Function to remove a domain
function removeDomain(domain) {
  chrome.storage.sync.get({whitelistDomains: []}, function(result) {
    const domains = result.whitelistDomains.filter(d => d !== domain);
    chrome.storage.sync.set({whitelistDomains: domains}, function() {
      loadDomains(); // Refresh list
    });
  });
}

// Setup language button handlers
function setupLanguageButtons() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const newLang = this.dataset.lang;
      console.log('Language button clicked:', newLang);
      
      try {
        // Load new language translations
        currentTranslations = await loadTranslations(newLang);
        console.log('Loaded new translations:', currentTranslations);
        
        // Save the selected language
        chrome.storage.sync.set({language: newLang}, function() {
          // Update UI
          document.querySelectorAll('.lang-btn').forEach(b => {
            b.classList.remove('active');
          });
          btn.classList.add('active');
          
          // Set html lang attribute
          document.documentElement.setAttribute('lang', newLang);
          
          // Show success message
          try {
            const languageCard = document.querySelector('.card:nth-child(4)');
            const container = languageCard.querySelector('.alert');
            if (container) {
              container.textContent = getMessage('save_success') || '✓ Language settings updated!';
              container.style.backgroundColor = '#d4edda';
              container.style.color = '#155724';
              container.style.borderLeftColor = '#28a745';
            }
          } catch (error) {
            console.error('Error updating language alert:', error);
          }
          
          // Apply translations immediately
          applyTranslations();
        });
      } catch (error) {
        console.error('Error switching language:', error);
        alert('Failed to switch language. Please try again.');
      }
    });
  });
}

function updateLanguageButtons() {
  const currentLang = localStorage.getItem('language') || 'zh';
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === currentLang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    // 恢复按钮状态
    btn.disabled = false;
    btn.style.opacity = '1';
    // 恢复按钮文本
    const langText = {
      'zh': '中文',
      'zh-HK': '繁體中文',
      'en': 'English',
      'ja': '日本語',
      'ko': '한국어',
      'vi': 'Tiếng Việt',
      'de': 'Deutsch',
      'fr': 'Français',
      'ru': 'Русский',
      'th': 'ไทย',
      'es': 'Español',
      'it': 'Italiano'
    };
    btn.textContent = langText[btn.dataset.lang];
  });
}

function setLanguage(lang) {
  // 禁用所有语言按钮
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
  });
  
  // 设置加载状态
  const loadingBtn = document.querySelector(`.lang-btn[data-lang="${lang}"]`);
  if (loadingBtn) {
    loadingBtn.innerHTML = '...';
  }
  
  // 延迟执行语言切换，避免过快切换
  setTimeout(() => {
    localStorage.setItem('language', lang);
    updateLanguageButtons();
    location.reload();
  }, 300);
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setLanguage(btn.dataset.lang);
  });
});

// 初始化语言按钮状态
updateLanguageButtons();