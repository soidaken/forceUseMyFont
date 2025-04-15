// In content.js
// Define a comprehensive fallback font stack
const fallbackFonts = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Function to apply font to all shadow DOM elements
function applyToShadowDOMs(fontFamily) {
  try {
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      if (element.shadowRoot) {
        const shadowStyle = document.createElement('style');
        shadowStyle.textContent = `* { font-family: ${fontFamily.includes(' ') ? '"' + fontFamily + '"' : fontFamily}, ${fallbackFonts} !important; }`;
        element.shadowRoot.appendChild(shadowStyle);
      }
    }
  } catch (error) {
    console.error("Error applying to shadow DOMs:", error);
  }
}

// Check if current domain is whitelisted before applying fonts
function isDomainWhitelisted(callback) {
  // Extract hostname from current page URL
  const hostname = window.location.hostname;
  
  // Get whitelist from storage
  chrome.storage.sync.get({whitelistDomains: []}, function(result) {
    const whitelistDomains = result.whitelistDomains;
    
    // Check if current hostname or its base domain is in whitelist
    const isWhitelisted = whitelistDomains.some(domain => {
      // Check exact match
      if (hostname === domain) return true;
      
      // Check if domain is a subdomain of a whitelisted domain
      // e.g. mail.example.com matches example.com in whitelist
      if (hostname.endsWith('.' + domain)) return true;
      
      return false;
    });
    
    callback(!isWhitelisted); // Callback with true if we should apply fonts (not whitelisted)
  });
}

// Wrap your existing code in the whitelist check
isDomainWhitelisted(shouldApplyFonts => {
  if (shouldApplyFonts) {
    // Get selected font first, then apply it
    chrome.storage.sync.get({selectedFont: null}, function(result) {
      if(!result.selectedFont) {
        console.log("selectedFont value is null");
        return;
      }
      const fontFamily = result.selectedFont;
      console.log("Using font:", fontFamily);
      

// Update the main applyFont function
function applyFont() {
  try {
    // Check if document.head exists
    if (!document.head) {
      console.log("Document head not ready yet, will retry later");
      return false;
    }
    
    // Check for existing style to avoid duplicates
    const existingStyle = document.getElementById('maple-mono-style');
    if (existingStyle) {
      return true;
    }
    
    const style = document.createElement('style');
    style.id = 'maple-mono-style';
    
    // Format the font name properly for CSS
    const formattedFont = fontFamily.includes(' ') ? `"${fontFamily}"` : fontFamily;
    
    // Use the comprehensive fallback font stack with inheritance for icon fonts
    style.textContent = `
      /* Regular elements - prepend our font to their existing font stack */
      html, body, div, span, applet, object, iframe, h1, h2, h3, h4, h5, h6, 
      p, blockquote, pre, a, abbr, acronym, address, big, cite, code, del, 
      dfn, em, img, ins, kbd, q, s, samp, small, strike, strong, sub, sup, 
      tt, var, b, u, center, dl, dt, dd, ol, ul, li, fieldset, form, label, 
      legend, table, caption, tbody, tfoot, thead, tr, th, td, article, aside, 
      canvas, details, embed, figure, figcaption, footer, header, hgroup, menu, 
      nav, output, ruby, section, summary, time, mark, audio, video, input, textarea, button {
        font-family: ${formattedFont}, ${fallbackFonts} !important;
      }
      
      /* Note view elements */
      #note-view, #note-view *, div#note-view, div#note-view * {
        font-family: ${formattedFont}, ${fallbackFonts} !important;
      }
      [class*="note-view"], [class*="note-view"] * {
        font-family: ${formattedFont}, ${fallbackFonts} !important;
      }
      
      /* Exclude common icon elements and icon fonts - don't apply our font to them */
      i, .fa, .fas, .far, .fab, [class*="icon"], [class*="Icon"],
      [class*="material-icons"], [class*="glyphicon"], [class*="fontawesome"],
      [class*="iconfont"], [class*="icon-font"], [class*="emoji"] {
        /* No change - use their original font */
      }
      
      /* All other elements - apply our font but keep original font as fallback */
      *:not(i):not(.fa):not(.fas):not(.far):not(.fab):not([class*="icon"]):not([class*="Icon"]):not([class*="material-icons"]):not([class*="glyphicon"]):not([class*="fontawesome"]):not([class*="iconfont"]):not([class*="icon-font"]):not([class*="emoji"]) {
        font-family: ${formattedFont}, inherit !important;
      }
    `;
    document.head.appendChild(style);
    console.log(`Font style applied successfully: ${fontFamily}`);
    
    // Apply to any shadow DOM elements
    applyToShadowDOMs(fontFamily);
    
    return true;
  } catch (error) {
    console.error("Error applying font style:", error);
    return false;
  }
}
      
// Update applyFontToNoteView function
function applyFontToNoteView() {
  // Format font properly for inline styles
  const formattedFont = fontFamily.includes(' ') ? `"${fontFamily}"` : fontFamily;
  
  // Try to find by ID first
  const noteViewById = document.getElementById('note-view');
  
  // Also find by class (which might have dynamic parts)
  const noteViewByClass = document.querySelector('[class*="note-view"]');
  
  const noteView = noteViewById || noteViewByClass;
  
  if (noteView) {
    console.log("Found note-view element, applying font specifically");
    noteView.style.fontFamily = `${formattedFont}, ${fallbackFonts}`;
    
    // Apply to all child elements
    const allNoteViewElements = noteView.querySelectorAll('*');
    allNoteViewElements.forEach(el => {
      el.style.fontFamily = `${formattedFont}, ${fallbackFonts}`;
    });
    
    // Check for shadow DOM in note-view
    if (noteView.shadowRoot) {
      const shadowStyle = document.createElement('style');
      shadowStyle.textContent = `* { font-family: ${fontFamily.includes(' ') ? '"' + fontFamily + '"' : fontFamily}, ${fallbackFonts} !important; }`;
      noteView.shadowRoot.appendChild(shadowStyle);
    }
  }
}
      
      // Function to wait for head element to be available
      function waitForHead() {
        if (document.head) {
          applyFont();
        } else {
          // Set up an observer to watch for when head gets created
          const observer = new MutationObserver(function(mutations) {
            if (document.head) {
              applyFont();
              observer.disconnect();
            }
          });
          
          observer.observe(document.documentElement || document, { 
            childList: true, 
            subtree: true 
          });
          
          // Also try again after a short delay
          setTimeout(waitForHead, 50);
        }
      }
      
      // Set up a specific observer for the note-view element
      function observeNoteView() {
        const observer = new MutationObserver((mutations) => {
          // Check if note-view exists after mutations (either by ID or class)
          if (document.getElementById('note-view') || document.querySelector('[class*="note-view"]')) {
            applyFontToNoteView();
          }
        });
        
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
          });
        } else {
          document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true
            });
          });
        }
        
        // Also check periodically for the note-view element
        setInterval(() => {
          if (document.getElementById('note-view') || document.querySelector('[class*="note-view"]')) {
            applyFontToNoteView();
          }
        }, 1000); // Check every second
      }
      
      // Start immediately
      waitForHead();
      observeNoteView();
      
      // Also try when DOM is ready
      document.addEventListener('DOMContentLoaded', () => {
        applyFont();
        applyFontToNoteView();
        
        // Set up observer for dynamic content changes
        const observer = new MutationObserver(() => {
          applyFont();
          applyToShadowDOMs(fontFamily);
          applyFontToNoteView();
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true
        });
      });
    });
  } else {
    console.log("Domain is whitelisted, not applying custom font");
  }
});