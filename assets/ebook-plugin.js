jQuery(document).ready(function($) {
    let swiper;
    let currentFontSize = 16;
    let searchResults = [];
    let currentSearchIndex = 0;

    // Initialize Swiper
    function initSwiper() {
        swiper = new Swiper('.swiper', {
            direction: 'horizontal',
            loop: false,
            slidesPerView: 1,
            spaceBetween: 10,
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
        });
    }

    initSwiper();

    // Font size controls
    function updateFontSize(size) {
        $('.chapter-text').css('font-size', size + 'px');
    }

    $('#increase-font').on('click', function() {
        if (currentFontSize < 32) {
            currentFontSize += 2;
            updateFontSize(currentFontSize);
        }
    });

    $('#decrease-font').on('click', function() {
        if (currentFontSize > 10) {
            currentFontSize -= 2;
            updateFontSize(currentFontSize);
        }
    });

    // Search functionality
    function searchInEbook(query) {
        if (!query.trim()) {
            clearSearchResults();
            return;
        }

        searchResults = [];
        const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

        $('.swiper-slide').each(function(index) {
            const $slide = $(this);
            const text = $slide.find('.chapter-text').text();
            const matches = text.match(searchRegex);

            if (matches) {
                searchResults.push({
                    slideIndex: index,
                    chapterTitle: $slide.find('.chapter-title').text(),
                    matchCount: matches.length
                });
            }
        });

        displaySearchResults(query);
    }

    function displaySearchResults(query) {
        const $resultsContainer = $('#search-results');
        $resultsContainer.empty();

        if (searchResults.length === 0) {
            $resultsContainer.append('<p>No results found.</p>');
            return;
        }

        searchResults.forEach((result, i) => {
            const $result = $('<div class="search-result"></div>');
            $result.text(`${result.chapterTitle} - ${result.matchCount} match(es)`);
            $result.on('click', function() {
                goToSearchResult(i);
            });
            $resultsContainer.append($result);
        });
    }

    function goToSearchResult(index) {
        if (index >= 0 && index < searchResults.length) {
            currentSearchIndex = index;
            const result = searchResults[index];
            swiper.slideTo(result.slideIndex);
        }
    }

    function clearSearchResults() {
        $('#search-results').empty();
        searchResults = [];
        currentSearchIndex = 0;
    }

    $('#search-button').on('click', function() {
        const query = $('#search-input').val();
        searchInEbook(query);
    });

    $('#clear-search').on('click', function() {
        $('#search-input').val('');
        clearSearchResults();
    });

    // Text-to-speech
    $('#read-aloud').on('click', function() {
        const $currentSlide = $('.swiper-slide').eq(swiper.activeIndex);
        const text = $currentSlide.find('.chapter-text').text();

        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        } else {
            alert('Sorry, your browser does not support text-to-speech.');
        }
    });
});
