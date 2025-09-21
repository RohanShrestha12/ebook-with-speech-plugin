/* ebook-plugin.js - Frontend JavaScript */
class EBookAudioManager {
    constructor() {
        this.currentAudio = null;
        this.isPlaying = false;
        this.currentChapter = null;
        this.playbackSpeed = 1.0;
        this.volume = 0.8;
        this.autoPlay = false;
        this.audioCache = new Map();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupAudioControls();
        this.loadSettings();
    }

    setupEventListeners() {
        // Generate audio button clicks
        jQuery(document).on('click', '.generate-audio-btn', (e) => {
            e.preventDefault();
            const chapterId = jQuery(e.target).data('chapter-id');
            this.generateAudio(chapterId);
        });

        // Play/Pause button clicks
        jQuery(document).on('click', '.audio-play-btn', (e) => {
            e.preventDefault();
            const audioElement = jQuery(e.target).closest('.audio-controls').find('audio')[0];
            this.togglePlayPause(audioElement);
        });

        // Speed control
        jQuery(document).on('change', '.audio-speed', (e) => {
            const speed = parseFloat(e.target.value);
            this.setPlaybackSpeed(speed);
        });

        // Volume control
        jQuery(document).on('change', '.audio-volume', (e) => {
            const volume = parseFloat(e.target.value);
            this.setVolume(volume);
        });

        // Auto-play toggle
        jQuery(document).on('change', '.auto-play-toggle', (e) => {
            this.autoPlay = e.target.checked;
            this.saveSettings();
        });

        // Chapter navigation with audio
        jQuery(document).on('click', '.ebook-next, .ebook-prev', () => {
            setTimeout(() => this.handleChapterChange(), 100);
        });

        // Swiper slide change
        if (window.ebookSwiper) {
            window.ebookSwiper.on('slideChange', () => {
                this.handleChapterChange();
            });
        }
    }

    setupAudioControls() {
        // Enhanced audio controls HTML
        const audioControlsHTML = `
            <div class="ebook-audio-panel">
                <div class="audio-global-controls">
                    <div class="audio-control-group">
                        <label>Speed:</label>
                        <select class="audio-speed">
                            <option value="0.5">0.5x</option>
                            <option value="0.75">0.75x</option>
                            <option value="1" selected>1x</option>
                            <option value="1.25">1.25x</option>
                            <option value="1.5">1.5x</option>
                            <option value="2">2x</option>
                        </select>
                    </div>
                    
                    <div class="audio-control-group">
                        <label>Volume:</label>
                        <input type="range" class="audio-volume" min="0" max="1" step="0.1" value="0.8">
                        <span class="volume-display">80%</span>
                    </div>
                    
                    <div class="audio-control-group">
                        <label>
                            <input type="checkbox" class="auto-play-toggle"> Auto-play next chapter
                        </label>
                    </div>
                    
                    <div class="audio-control-group">
                        <button class="btn-stop-all">Stop All</button>
                        <button class="btn-download-all">Download All Audio</button>
                    </div>
                </div>
            </div>
        `;

        // Add to ebook container
        jQuery('.ebook-container').prepend(audioControlsHTML);
    }

    generateAudio(chapterId) {
        const button = jQuery(`.generate-audio-btn[data-chapter-id="${chapterId}"]`);
        const statusDiv = button.siblings('.audio-status') || button.parent().find('.audio-generation-status');
        
        // Show loading state
        button.prop('disabled', true).text('Generating...');
        statusDiv.html('<div class="audio-loading">🔄 Generating audio, please wait...</div>');

        // Prepare form data
        const formData = {
            action: 'convert_text_to_audio',
            chapter_id: chapterId,
            nonce: ebook_ajax.nonce
        };

        jQuery.ajax({
            url: ebook_ajax.ajax_url,
            type: 'POST',
            data: formData,
            timeout: 120000, // 2 minutes timeout
            success: (response) => {
                if (response.success) {
                    this.handleAudioGenerated(chapterId, response.data.audio_url);
                    statusDiv.html('<div class="audio-success">✅ ' + response.data.message + '</div>');
                    
                    // Update the audio controls
                    this.updateAudioControls(chapterId, response.data.audio_url);
                } else {
                    statusDiv.html('<div class="audio-error">❌ ' + response.data + '</div>');
                }
            },
            error: (xhr, status, error) => {
                let errorMsg = 'Failed to generate audio';
                if (status === 'timeout') {
                    errorMsg = 'Request timeout - audio generation is taking too long';
                } else if (xhr.responseJSON && xhr.responseJSON.data) {
                    errorMsg = xhr.responseJSON.data;
                }
                statusDiv.html('<div class="audio-error">❌ ' + errorMsg + '</div>');
            },
            complete: () => {
                button.prop('disabled', false).text('Regenerate Audio');
            }
        });
    }

    handleAudioGenerated(chapterId, audioUrl) {
        // Cache the audio URL
        this.audioCache.set(chapterId, audioUrl);
        
        // Trigger custom event
        jQuery(document).trigger('ebookAudioGenerated', { chapterId, audioUrl });
        
        console.log(`Audio generated for chapter ${chapterId}: ${audioUrl}`);
    }

    updateAudioControls(chapterId, audioUrl) {
        const chapterElement = jQuery(`.ebook-chapter[data-chapter-id="${chapterId}"]`);
        const audioControls = chapterElement.find('.audio-controls');
        
        // Update or create audio element
        let audioElement = audioControls.find('audio');
        if (audioElement.length === 0) {
            audioElement = jQuery('<audio controls preload="metadata"></audio>');
            audioControls.prepend(audioElement);
        }
        
        audioElement.attr('src', audioUrl);
        
        // Add enhanced controls
        const enhancedControls = `
            <div class="enhanced-audio-controls">
                <button class="audio-play-btn" title="Play/Pause">▶️</button>
                <button class="audio-rewind" title="Rewind 10s">⏪</button>
                <button class="audio-forward" title="Forward 10s">⏩</button>
                <span class="audio-time">00:00 / 00:00</span>
                <button class="audio-download" data-url="${audioUrl}" title="Download">💾</button>
            </div>
        `;
        
        audioControls.find('.enhanced-audio-controls').remove();
        audioControls.append(enhancedControls);
        
        // Setup audio element events
        this.setupAudioElementEvents(audioElement[0], chapterId);
    }

    setupAudioElementEvents(audioElement, chapterId) {
        audioElement.addEventListener('loadedmetadata', () => {
            this.updateAudioTime(audioElement);
        });

        audioElement.addEventListener('timeupdate', () => {
            this.updateAudioTime(audioElement);
        });

        audioElement.addEventListener('ended', () => {
            if (this.autoPlay) {
                this.playNextChapter();
            }
        });

        audioElement.addEventListener('play', () => {
            this.pauseOtherAudio(audioElement);
            this.currentAudio = audioElement;
            this.isPlaying = true;
        });

        audioElement.addEventListener('pause', () => {
            this.isPlaying = false;
        });

        // Set initial volume and speed
        audioElement.volume = this.volume;
        audioElement.playbackRate = this.playbackSpeed;
    }

    updateAudioTime(audioElement) {
        const current = this.formatTime(audioElement.currentTime);
        const duration = this.formatTime(audioElement.duration);
        const timeDisplay = jQuery(audioElement).siblings('.enhanced-audio-controls').find('.audio-time');
        timeDisplay.text(`${current} / ${duration}`);
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    togglePlayPause(audioElement) {
        if (audioElement.paused) {
            audioElement.play();
        } else {
            audioElement.pause();
        }
    }

    pauseOtherAudio(currentAudio) {
        jQuery('audio').each((index, audio) => {
            if (audio !== currentAudio && !audio.paused) {
                audio.pause();
            }
        });
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = speed;
        jQuery('audio').each((index, audio) => {
            audio.playbackRate = speed;
        });
        this.saveSettings();
    }

    setVolume(volume) {
        this.volume = volume;
        jQuery('audio').each((index, audio) => {
            audio.volume = volume;
        });
        jQuery('.volume-display').text(Math.round(volume * 100) + '%');
        this.saveSettings();
    }

    handleChapterChange() {
        const activeSlide = jQuery('.swiper-slide-active');
        const chapterId = activeSlide.data('chapter-id');
        
        if (chapterId && this.autoPlay) {
            setTimeout(() => {
                const audioElement = activeSlide.find('audio')[0];
                if (audioElement && audioElement.src) {
                    audioElement.play();
                }
            }, 500);
        }
    }

    playNextChapter() {
        if (window.ebookSwiper) {
            window.ebookSwiper.slideNext();
        } else {
            jQuery('.ebook-next').click();
        }
    }

    stopAllAudio() {
        jQuery('audio').each((index, audio) => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.isPlaying = false;
        this.currentAudio = null;
    }

    downloadAllAudio() {
        const audioUrls = [];
        jQuery('audio[src]').each((index, audio) => {
            audioUrls.push(audio.src);
        });

        if (audioUrls.length === 0) {
            alert('No audio files available for download');
            return;
        }

        // Create zip file with all audio (you'll need a zip library for this)
        // For now, just download each file individually
        audioUrls.forEach((url, index) => {
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = url;
                link.download = `chapter-${index + 1}-audio.mp3`;
                link.click();
            }, index * 1000); // Delay downloads to avoid browser blocking
        });
    }

    saveSettings() {
        const settings = {
            playbackSpeed: this.playbackSpeed,
            volume: this.volume,
            autoPlay: this.autoPlay
        };
        localStorage.setItem('ebookAudioSettings', JSON.stringify(settings));
    }

    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('ebookAudioSettings') || '{}');
            this.playbackSpeed = settings.playbackSpeed || 1.0;
            this.volume = settings.volume || 0.8;
            this.autoPlay = settings.autoPlay || false;
            
            // Apply settings to UI
            jQuery('.audio-speed').val(this.playbackSpeed);
            jQuery('.audio-volume').val(this.volume);
            jQuery('.auto-play-toggle').prop('checked', this.autoPlay);
            jQuery('.volume-display').text(Math.round(this.volume * 100) + '%');
        } catch (e) {
            console.warn('Failed to load audio settings:', e);
        }
    }

    // Keyboard shortcuts
    setupKeyboardShortcuts() {
        jQuery(document).on('keydown', (e) => {
            if (e.target.tagName.toLowerCase() === 'input') return;
            
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    if (this.currentAudio) {
                        this.togglePlayPause(this.currentAudio);
                    }
                    break;
                case 'ArrowLeft':
                    if (e.ctrlKey && this.currentAudio) {
                        e.preventDefault();
                        this.currentAudio.currentTime -= 10;
                    }
                    break;
                case 'ArrowRight':
                    if (e.ctrlKey && this.currentAudio) {
                        e.preventDefault();
                        this.currentAudio.currentTime += 10;
                    }
                    break;
                case 'ArrowUp':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.setVolume(Math.min(1, this.volume + 0.1));
                    }
                    break;
                case 'ArrowDown':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.setVolume(Math.max(0, this.volume - 0.1));
                    }
                    break;
            }
        });
    }
}

// Additional event handlers for enhanced controls
jQuery(document).ready(function() {
    // Initialize audio manager
    window.ebookAudioManager = new EBookAudioManager();
    window.ebookAudioManager.setupKeyboardShortcuts();
    
    // Rewind/Forward buttons
    jQuery(document).on('click', '.audio-rewind', function() {
        const audio = jQuery(this).closest('.audio-controls').find('audio')[0];
        if (audio) {
            audio.currentTime = Math.max(0, audio.currentTime - 10);
        }
    });
    
    jQuery(document).on('click', '.audio-forward', function() {
        const audio = jQuery(this).closest('.audio-controls').find('audio')[0];
        if (audio) {
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
        }
    });
    
    // Download individual audio
    jQuery(document).on('click', '.audio-download', function() {
        const url = jQuery(this).data('url');
        const link = document.createElement('a');
        link.href = url;
        link.download = 'chapter-audio.mp3';
        link.click();
    });
    
    // Stop all audio
    jQuery(document).on('click', '.btn-stop-all', function() {
        window.ebookAudioManager.stopAllAudio();
    });
    
    // Download all audio
    jQuery(document).on('click', '.btn-download-all', function() {
        window.ebookAudioManager.downloadAllAudio();
    });
    
    // Progress bar for audio
    jQuery(document).on('click', 'audio', function(e) {
        const audio = this;
        const rect = audio.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
    });
});


jQuery(document).ready(function($) {
    
    // Initialize Swiper for each eBook slider
    $('.ebook-slider').each(function() {
        const $container = $(this).closest('.ebook-container');
        const $prevBtn = $container.find('.ebook-prev');
        const $nextBtn = $container.find('.ebook-next');
        const $currentChapter = $container.find('.current-chapter');
        const $totalChapters = $container.find('.total-chapters');
        
        // Initialize Swiper
        const swiper = new Swiper(this, {
            direction: 'horizontal',
            loop: false,
            speed: 600,
            effect: 'slide',
            
            // Navigation
            navigation: {
                nextEl: $nextBtn[0],
                prevEl: $prevBtn[0],
            },
            
            // Pagination
            pagination: {
                el: $container.find('.swiper-pagination')[0],
                clickable: true,
                dynamicBullets: true,
            },
            
            // Keyboard control
            keyboard: {
                enabled: true,
                onlyInViewport: true,
            },
            
            // Mouse wheel
            mousewheel: {
                enabled: true,
                forceToAxis: true,
            },
            
            // Touch gestures
            touchEventsTarget: 'container',
            simulateTouch: true,
            
            // Accessibility
            a11y: {
                enabled: true,
                prevSlideMessage: 'Previous chapter',
                nextSlideMessage: 'Next chapter',
            },
            
            // Callbacks
            on: {
                init: function() {
                    updateProgress(this, $currentChapter, $prevBtn, $nextBtn);
                    // Auto-focus on first slide for better accessibility
                    setTimeout(() => {
                        $(this.slides[0]).attr('tabindex', '0').focus();
                    }, 100);
                },
                
                slideChange: function() {
                    updateProgress(this, $currentChapter, $prevBtn, $nextBtn);
                    
                    // Update URL hash for bookmarking
                    const activeSlide = $(this.slides[this.activeIndex]);
                    const chapterId = activeSlide.data('chapter-id');
                    if (chapterId) {
                        window.history.replaceState(null, null, `#chapter-${chapterId}`);
                    }
                    
                    // Pause all audio in non-active slides
                    $(this.slides).find('audio').each(function() {
                        if (this.pause) {
                            this.pause();
                        }
                    });
                },
                
                transitionEnd: function() {
                    // Focus management for accessibility
                    $(this.slides[this.activeIndex]).attr('tabindex', '0');
                    $(this.slides).not(':eq(' + this.activeIndex + ')').attr('tabindex', '-1');
                }
            }
        });
        
        // Store swiper instance for later use
        $(this).data('swiper', swiper);
        
        // Handle hash navigation on page load
        if (window.location.hash) {
            const hash = window.location.hash.substring(1);
            if (hash.startsWith('chapter-')) {
                const chapterId = hash.replace('chapter-', '');
                const slideIndex = $container.find(`[data-chapter-id="${chapterId}"]`).index();
                if (slideIndex !== -1) {
                    setTimeout(() => {
                        swiper.slideTo(slideIndex, 0);
                    }, 100);
                }
            }
        }
        
        // Keyboard shortcuts
        $(document).on('keydown', function(e) {
            if (!$container.is(':visible')) return;
            
            switch(e.keyCode) {
                case 37: // Left arrow
                case 38: // Up arrow
                    if (e.target.tagName.toLowerCase() !== 'input' && 
                        e.target.tagName.toLowerCase() !== 'textarea') {
                        e.preventDefault();
                        swiper.slidePrev();
                    }
                    break;
                case 39: // Right arrow
                case 40: // Down arrow
                    if (e.target.tagName.toLowerCase() !== 'input' && 
                        e.target.tagName.toLowerCase() !== 'textarea') {
                        e.preventDefault();
                        swiper.slideNext();
                    }
                    break;
                case 36: // Home
                    if (e.ctrlKey) {
                        e.preventDefault();
                        swiper.slideTo(0);
                    }
                    break;
                case 35: // End
                    if (e.ctrlKey) {
                        e.preventDefault();
                        swiper.slideTo(swiper.slides.length - 1);
                    }
                    break;
            }
        });
    });
    
    // Audio Generation
    $(document).on('click', '.generate-audio-btn', function(e) {
        e.preventDefault();
        
        const $btn = $(this);
        const chapterId = $btn.data('chapter-id');
        const $audioControls = $btn.closest('.audio-controls');
        
        if (!chapterId) {
            showNotification('Error: Chapter ID not found', 'error');
            return;
        }
        
        // Disable button and show loading state
        $btn.prop('disabled', true)
            .addClass('loading')
            .text('Generating Audio...');
        
        // Show progress message
        const $status = $('<div class="audio-status">Processing chapter content...</div>');
        $audioControls.append($status);
        
        $.ajax({
            url: ebook_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'convert_text_to_audio',
                chapter_id: chapterId,
                nonce: ebook_ajax.nonce
            },
            timeout: 60000, // 60 second timeout
            success: function(response) {
                if (response.success) {
                    // Remove existing audio player if any
                    $audioControls.find('audio').remove();
                    
                    // Add new audio player
                    const audioHtml = `
                        <audio controls preload="metadata" style="width: 100%; margin-bottom: 10px;">
                            <source src="${response.data.audio_url}" type="audio/mpeg">
                            Your browser does not support the audio element.
                        </audio>
                    `;
                    $audioControls.prepend(audioHtml);
                    
                    // Update button text
                    $btn.text('Regenerate Audio');
                    
                    showNotification(response.data.message || 'Audio generated successfully!', 'success');
                } else {
                    showNotification(response.data || 'Failed to generate audio', 'error');
                }
            },
            error: function(xhr, status, error) {
                let errorMessage = 'Failed to generate audio';
                
                if (status === 'timeout') {
                    errorMessage = 'Request timed out. Please try again.';
                } else if (xhr.responseJSON && xhr.responseJSON.data) {
                    errorMessage = xhr.responseJSON.data;
                } else if (error) {
                    errorMessage = 'Error: ' + error;
                }
                
                showNotification(errorMessage, 'error');
            },
            complete: function() {
                // Re-enable button and remove loading state
                $btn.prop('disabled', false)
                    .removeClass('loading');
                
                // Remove status message
                $status.fadeOut(300, function() {
                    $(this).remove();
                });
            }
        });
    });
    
    // Auto-save reading progress
    let progressTimeout;
    $(document).on('slideChange', '.ebook-slider', function() {
        const swiper = $(this).data('swiper');
        if (swiper) {
            clearTimeout(progressTimeout);
            progressTimeout = setTimeout(() => {
                saveReadingProgress(swiper.activeIndex);
            }, 2000);
        }
    });
    
    // Audio player enhancements
    $(document).on('loadedmetadata', 'audio', function() {
        // Add time display
        const $audio = $(this);
        const $controls = $audio.closest('.audio-controls');
        
        if (!$controls.find('.audio-time').length) {
            const duration = formatTime(this.duration);
            $controls.append(`<div class="audio-time">Duration: ${duration}</div>`);
        }
    });
    
    $(document).on('timeupdate', 'audio', function() {
        const $audio = $(this);
        const $controls = $audio.closest('.audio-controls');
        const $timeDisplay = $controls.find('.audio-time');
        
        if ($timeDisplay.length) {
            const current = formatTime(this.currentTime);
            const duration = formatTime(this.duration);
            $timeDisplay.text(`${current} / ${duration}`);
        }
    });
    
    // Utility Functions
    function updateProgress(swiper, $currentChapter, $prevBtn, $nextBtn) {
        const current = swiper.activeIndex + 1;
        const total = swiper.slides.length;
        
        $currentChapter.text(current);
        
        // Update button states
        $prevBtn.prop('disabled', swiper.isBeginning);
        $nextBtn.prop('disabled', swiper.isEnd);
        
        // Add visual feedback for completion
        if (current === total) {
            setTimeout(() => {
                const $container = swiper.$el.closest('.ebook-container');
                if (!$container.find('.completion-message').length) {
                    const $message = $('<div class="completion-message" style="text-align: center; margin-top: 20px; padding: 15px; background: #d4edda; color: #155724; border-radius: 8px; border: 1px solid #c3e6cb;">🎉 Congratulations! You\'ve finished reading this eBook!</div>');
                    $container.append($message);
                    
                    setTimeout(() => {
                        $message.fadeOut(5000);
                    }, 3000);
                }
            }, 1000);
        }
    }
    
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        $('.ebook-notification').remove();
        
        const typeClass = type === 'error' ? 'error' : type === 'success' ? 'success' : 'info';
        const bgColor = type === 'error' ? '#f8d7da' : type === 'success' ? '#d4edda' : '#d1ecf1';
        const textColor = type === 'error' ? '#721c24' : type === 'success' ? '#155724' : '#0c5460';
        const borderColor = type === 'error' ? '#f5c6cb' : type === 'success' ? '#c3e6cb' : '#bee5eb';
        
        const $notification = $(`
            <div class="ebook-notification ${typeClass}" style="
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                padding: 15px 20px;
                background: ${bgColor};
                color: ${textColor};
                border: 1px solid ${borderColor};
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                max-width: 300px;
                font-size: 14px;
                line-height: 1.4;
                cursor: pointer;
                animation: slideIn 0.3s ease-out;
            ">${message}</div>
        `);
        
        $('body').append($notification);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            $notification.fadeOut(300, function() {
                $(this).remove();
            });
        }, 5000);
        
        // Click to dismiss
        $notification.on('click', function() {
            $(this).fadeOut(300, function() {
                $(this).remove();
            });
        });
    }
    
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === 0) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
    
    function saveReadingProgress(chapterIndex) {
        // Save to localStorage (if available)
        if (typeof(Storage) !== "undefined") {
            const ebookId = $('.ebook-container').data('ebook-id') || 'current-ebook';
            localStorage.setItem(`ebook_progress_${ebookId}`, chapterIndex);
        }
    }
    
    function loadReadingProgress() {
        // Load from localStorage (if available)
        if (typeof(Storage) !== "undefined") {
            const ebookId = $('.ebook-container').data('ebook-id') || 'current-ebook';
            const savedProgress = localStorage.getItem(`ebook_progress_${ebookId}`);
            
            if (savedProgress !== null) {
                const chapterIndex = parseInt(savedProgress);
                const swiper = $('.ebook-slider').data('swiper');
                
                if (swiper && chapterIndex < swiper.slides.length) {
                    // Show restore option
                    const $restoreMsg = $(`
                        <div class="reading-progress-restore" style="
                            background: #fff3cd;
                            border: 1px solid #ffeaa7;
                            color: #856404;
                            padding: 15px;
                            margin-bottom: 20px;
                            border-radius: 8px;
                            text-align: center;
                        ">
                            <p>Continue reading from Chapter ${chapterIndex + 1}?</p>
                            <button class="button-restore" style="
                                background: #667eea;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                margin-right: 10px;
                                cursor: pointer;
                            ">Continue</button>
                            <button class="button-start-over" style="
                                background: #6c757d;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                            ">Start Over</button>
                        </div>
                    `);
                    
                    $('.ebook-container').prepend($restoreMsg);
                    
                    $restoreMsg.find('.button-restore').on('click', function() {
                        swiper.slideTo(chapterIndex, 600);
                        $restoreMsg.fadeOut();
                    });
                    
                    $restoreMsg.find('.button-start-over').on('click', function() {
                        localStorage.removeItem(`ebook_progress_${ebookId}`);
                        $restoreMsg.fadeOut();
                    });
                }
            }
        }
    }
    
    // Initialize reading progress
    setTimeout(loadReadingProgress, 1000);
    
    // Add CSS animations
    if (!$('#ebook-animations').length) {
        $('head').append(`
            <style id="ebook-animations">
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                .swiper-slide {
                    transition: transform 0.3s ease;
                }
                
                .ebook-chapter:not(.swiper-slide-active) .chapter-text {
                    opacity: 0.7;
                }
                
                .ebook-chapter.swiper-slide-active .chapter-text {
                    opacity: 1;
                    animation: fadeIn 0.5s ease-in;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0.7; }
                    to { opacity: 1; }
                }
            </style>
        `);
    }
});

// Fullscreen API support
if (document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled) {
    jQuery(document).ready(function($) {
        // Add fullscreen button
        $('.ebook-controls').append(`
            <button class="ebook-btn ebook-fullscreen" title="Toggle Fullscreen">
                <span class="fullscreen-icon">⛶</span>
            </button>
        `);
        
        $(document).on('click', '.ebook-fullscreen', function() {
            const container = $(this).closest('.ebook-container')[0];
            
            if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
                // Enter fullscreen
                if (container.requestFullscreen) {
                    container.requestFullscreen();
                } else if (container.webkitRequestFullscreen) {
                    container.webkitRequestFullscreen();
                } else if (container.mozRequestFullScreen) {
                    container.mozRequestFullScreen();
                } else if (container.msRequestFullscreen) {
                    container.msRequestFullscreen();
                }
                $(this).find('.fullscreen-icon').text('⛷');
            } else {
                // Exit fullscreen
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
                $(this).find('.fullscreen-icon').text('⛶');
            }
        });
        
        // Listen for fullscreen changes
        $(document).on('fullscreenchange webkitfullscreenchange mozfullscreenchange MSFullscreenChange', function() {
            const $btn = $('.ebook-fullscreen');
            if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
                $btn.find('.fullscreen-icon').text('⛷');
                $('.ebook-container').addClass('fullscreen-mode');
            } else {
                $btn.find('.fullscreen-icon').text('⛶');
                $('.ebook-container').removeClass('fullscreen-mode');
            }
        });
    });
}