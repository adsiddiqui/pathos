document.addEventListener('DOMContentLoaded', () => {
    // Header scroll functionality
    let lastScrollY = 0;
    let ticking = false;
    const header = document.querySelector('.header');
    const SCROLL_THRESHOLD = 50;
    
    const updateHeader = () => {
        const currentScrollY = window.scrollY;
        const scrollingDown = currentScrollY > lastScrollY;
        const scrolledPastThreshold = currentScrollY > SCROLL_THRESHOLD;
        
        if (scrollingDown && scrolledPastThreshold) {
            header.classList.add('hidden');
        } else {
            header.classList.remove('hidden');
        }
        
        lastScrollY = currentScrollY;
        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateHeader();
                ticking = false;
            });
            ticking = true;
        }
    });

    // Mood selection functionality
    const moodButtons = document.querySelectorAll('.sentiment-card');
    
    moodButtons.forEach(button => {
        button.addEventListener('click', async () => {
            // Remove any existing clones or overlays first
            document.querySelectorAll('.sentiment-card.expanded').forEach(el => el.remove());
            const existingOverlay = document.querySelector('.mood-overlay');
            if (existingOverlay) existingOverlay.remove();

            const mood = button.dataset.sentiment;
            const moodMap = {
                'peaceful': 'park',
                'positive': 'portal',
                'neutral': 'beach',
                'excited': 'christmas'
            };

            // Create a fresh clone of the button
            const buttonClone = button.cloneNode(true);
            buttonClone.classList.add('expanded');
            buttonClone.style.position = 'fixed';
            buttonClone.style.zIndex = '1001';
            buttonClone.style.opacity = '0'; // Start invisible
            document.body.appendChild(buttonClone);

            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'mood-overlay';
            document.body.appendChild(overlay);

            // Create loading cursor
            const loadingCursor = document.createElement('div');
            loadingCursor.className = 'loading-cursor';
            document.body.appendChild(loadingCursor);

            // Hide original button
            button.style.visibility = 'hidden';

            // Force a reflow before animation
            buttonClone.offsetHeight;

            // Start the fade-in
            requestAnimationFrame(() => {
                overlay.classList.add('active');
                buttonClone.classList.add('fade-in');
                buttonClone.style.opacity = '1';
            });

            setTimeout(async () => {
                try {
                    showLoading();
                    const articles = await readMoodDatabase(moodMap[mood]);
                    
                    // Fade out expanded card smoothly
                    buttonClone.style.opacity = '0';
                    overlay.style.opacity = '0';
                    
                    setTimeout(() => {
                        buttonClone.remove();
                        button.style.visibility = 'visible';
                        overlay.classList.remove('active');
                        document.querySelector('.main-content').classList.add('blurred');
                        loadingCursor.remove();
                        
                        displayArticles(articles);
                    }, 800);

                } catch (error) {
                    console.error('Error:', error);
                    showError('Failed to load articles');
                    loadingCursor.remove();
                    buttonClone.remove();
                    button.style.visibility = 'visible';
                } finally {
                    hideLoading();
                }
            }, 2000);
        });
    });
});

// Add this at the top of the file to store used articles
const usedArticles = {
    park: new Set(),
    beach: new Set(),
    portal: new Set(),
    christmas: new Set()
};

async function readMoodDatabase(mood) {
    try {
        console.log(`Reading database for mood: ${mood}`);
        console.log(`Currently used articles for ${mood}:`, usedArticles[mood]);

        const response = await fetch(`database-${mood}.csv?nocache=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.text();
        
        // Parse CSV data and clean it up
        const rows = data.split('\n')
            .slice(1)  // skip header
            .map(row => row.replace(/,+$/, ''))  // remove trailing commas
            .filter(row => row.trim());
            
        if (rows.length === 0) {
            throw new Error('CSV file is empty or has no data rows');
        }
        
        // Parse all articles
        const allArticles = rows.map(row => {
            try {
                // Use regex to match quoted fields and handle commas within quotes
                const matches = row.match(/^"([^"]+)","([^"]+)","([^"]+)"$/);
                if (!matches) {
                    // Try without quotes if quoted pattern doesn't match
                    const basicMatches = row.match(/^([^,]+),([^,]+),(.+)$/);
                    if (!basicMatches) {
                        console.error('Invalid row format:', row);
                        return null;
                    }
                    return createArticle(basicMatches[1], basicMatches[2], basicMatches[3]);
                }
                return createArticle(matches[1], matches[2], matches[3]);
            } catch (e) {
                console.error('Error parsing row:', row, e);
                return null;
            }
        }).filter(article => article && article.title && article.url);

        console.log(`Total articles available: ${allArticles.length}`);

        // Filter out previously used articles
        const unusedArticles = allArticles.filter(article => 
            !usedArticles[mood].has(article.url)
        );

        console.log(`Unused articles available: ${unusedArticles.length}`);

        // If we've used all articles, reset the used articles set
        if (unusedArticles.length === 0) {
            console.log(`Resetting used articles for ${mood}`);
            usedArticles[mood].clear();
            const randomArticle = allArticles[Math.floor(Math.random() * allArticles.length)];
            usedArticles[mood].add(randomArticle.url);
            return [randomArticle];
        }

        // Randomly select from unused articles
        const randomIndex = Math.floor(Math.random() * unusedArticles.length);
        const selectedArticle = unusedArticles[randomIndex];
        
        // Mark this article as used
        usedArticles[mood].add(selectedArticle.url);
        console.log(`Selected article URL: ${selectedArticle.url}`);
        console.log(`Updated used articles for ${mood}:`, usedArticles[mood]);

        return [selectedArticle];
    } catch (error) {
        console.error('Error reading database:', error);
        throw error;
    }
}

// Helper function to create article object
function createArticle(title, url, summary) {
    try {
        // Extract URL if it's embedded in title or summary
        let cleanTitle = title;
        let cleanUrl = url;
        let cleanSummary = summary;

        // Look for URLs in title or summary
        const urlPattern = /https?:\/\/[^\s,"]*/;
        
        if (!url.match(urlPattern)) {
            // If URL is not in URL column, look for it in title or summary
            const titleMatch = title.match(urlPattern);
            const summaryMatch = summary.match(urlPattern);
            
            if (titleMatch) {
                cleanUrl = titleMatch[0];
                cleanTitle = title.replace(urlPattern, '').trim();
            } else if (summaryMatch) {
                cleanUrl = summaryMatch[0];
                cleanSummary = summary.replace(urlPattern, '').trim();
            }
        }

        // Clean up the URL
        cleanUrl = cleanUrl.trim()
            .replace(/^["'](.*)["']$/, '$1')
            .replace(/\s+/g, '')
            .replace(/["']/g, '')
            .trim();

        // Add back protocol if needed
        const finalUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
        
        return {
            title: cleanTitle.trim(),
            url: finalUrl,
            aiSummary: cleanSummary.trim()
        };
    } catch (e) {
        console.error('Error creating article:', e);
        return null;
    }
}

function displayArticles(articles) {
    if (!articles || articles.length === 0) {
        showError('No articles found');
        return;
    }

    // Just use the first article since we're only sending one
    const article = articles[0];

    // Disable all mood buttons
    document.querySelectorAll('.sentiment-card').forEach(card => {
        card.style.pointerEvents = 'none';
    });

    // Create overlay for popup
    const popupOverlay = document.createElement('div');
    popupOverlay.className = 'popup-overlay';
    document.body.appendChild(popupOverlay);

    // Create popup
    const popup = document.createElement('div');
    popup.className = 'article-popup';
    popup.style.opacity = '0';
    
    popup.innerHTML = `
        <button class="popup-close" aria-label="Close popup"></button>
        <div class="article-content">
            <h2>${article.title}</h2>
            <p class="ai-summary">${article.aiSummary}</p>
            <a href="#" class="read-article-btn">Read article</a>
        </div>
    `;
    document.body.appendChild(popup);

    // Force a reflow before starting the fade in
    popup.offsetHeight;

    // Fade in smoothly
    requestAnimationFrame(() => {
        popup.classList.add('active');
        popup.style.opacity = '1';
    });

    // Fix the link click handler
    const articleLink = popup.querySelector('.read-article-btn');
    articleLink.href = article.url;  // Set the href directly
    articleLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(article.url, '_blank');
    });

    // Add close functionality
    const closePopup = () => {
        popup.classList.remove('active');
        popupOverlay.classList.remove('active');
        document.querySelector('.main-content').classList.remove('blurred');
        
        // Reset button states
        document.querySelectorAll('.sentiment-card').forEach(card => {
            card.style.pointerEvents = 'auto';
            card.style.visibility = 'visible';
        });

        setTimeout(() => {
            popup.remove();
            popupOverlay.remove();
            
            // Clean up any expanded cards and overlays
            document.querySelectorAll('.sentiment-card.expanded').forEach(el => el.remove());
            const overlay = document.querySelector('.mood-overlay');
            if (overlay) overlay.remove();
        }, 500);
    };

    // Add click handler for close button
    const closeButton = popup.querySelector('.popup-close');
    closeButton.addEventListener('click', closePopup);

    // Close on clicking overlay/outside
    popupOverlay.addEventListener('click', closePopup);

    // Prevent closing when clicking inside the popup
    popup.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePopup();
        }
    });

    // Show popup and overlay
    setTimeout(() => {
        popupOverlay.classList.add('active');
        popup.classList.add('active');
    }, 50);
}

function showLoading() {
    const loadingElement = document.getElementById('loading');
    const articlesContainer = document.getElementById('articles');
    if (loadingElement) loadingElement.classList.remove('hidden');
    if (articlesContainer) articlesContainer.innerHTML = '';
}

function hideLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) loadingElement.classList.add('hidden');
}

function showError(message) {
    const errorElement = document.getElementById('error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }
} 