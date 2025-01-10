// ==UserScript==
// @name         FurAffinity Filter
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description
// @author       Mr.None
// @match        https://www.furaffinity.net/gallery/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let settings = {
        showNotifications: true,
        buttonColor: '#6200EA',
        allowedClasses: ['r-adult t-image'],
        fixedButtons: true,
        autoFilter: false 
    };

    const saveSettings = () => {
        localStorage.setItem('faCleanerSettings', JSON.stringify(settings));
    };

    const loadSettings = () => {
        const storedSettings = localStorage.getItem('faCleanerSettings');
        if (storedSettings) {
            settings = JSON.parse(storedSettings);
        }
    };

    loadSettings();

    const saveElementPosition = (elementId, top, left) => {
        const positions = JSON.parse(localStorage.getItem('elementPositions')) || {};
        positions[elementId] = { top, left };
        localStorage.setItem('elementPositions', JSON.stringify(positions));
    };

    const loadElementPosition = (elementId) => {
        const positions = JSON.parse(localStorage.getItem('elementPositions')) || {};
        return positions[elementId] || { top: null, left: null };
    };

    const makeElementDraggable = (element, id) => {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        const onMouseDown = (e) => {
            if (e.button !== 1) return; 
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();   
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            element.style.left = `${initialX + dx}px`;
            element.style.top = `${initialY + dy}px`;
        };

        const onMouseUp = () => {
            isDragging = false;
            saveElementPosition(id, element.style.top, element.style.left);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        element.addEventListener('mousedown', onMouseDown);

        const savedPosition = loadElementPosition(id);
        if (savedPosition.top && savedPosition.left) {
            element.style.top = savedPosition.top;
            element.style.left = savedPosition.left;
        }

        updateFixedPosition(element);
    };

    const updateFixedPosition = (element) => {
        element.style.position = settings.fixedButtons ? 'fixed' : 'absolute';
    };

    const createButton = (id, text, style, onClick) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.id = id;
        button.style.zIndex = '1000';
        Object.assign(button.style, style);
        button.addEventListener('click', onClick);
        document.body.appendChild(button);

        makeElementDraggable(button, id);
        return button;
    };

    const createDraggableMenu = (id, style) => {
        const menu = document.createElement('div');
        menu.id = id;
        menu.style.position = 'absolute';
        menu.style.zIndex = '1000';
        Object.assign(menu.style, style);

        makeElementDraggable(menu, id);
        return menu;
    };

    const filterGallery = () => {
        const gallery = document.querySelector('#gallery-gallery');
        if (gallery) {
            const figures = gallery.querySelectorAll('figure');
            let hiddenCount = 0;
            let shownCount = 0;

            figures.forEach(figure => {
                const figureClass = figure.className;
                if (settings.allowedClasses.some(allowed => figureClass.includes(allowed))) {
                    figure.style.display = '';
                    shownCount++;
                } else {
                    figure.style.display = 'none';
                    hiddenCount++;
                }
            });

            if (settings.showNotifications) {
                alert(`Hidden: ${hiddenCount}\nShown: ${shownCount}`);
            }
        } else {
            alert('Element #gallery-gallery not found.');
        }
    };

    const openVisibleLinks = () => {
        const gallery = document.querySelector('#gallery-gallery');
        if (gallery) {
            const uniqueUrls = new Set();
            const visibleLinks = gallery.querySelectorAll('figure:not([style*="display: none"]) a[href]');
            visibleLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href.startsWith('/view/')) {
                    const url = `https://www.furaffinity.net${href}`;
                    if (!uniqueUrls.has(url)) {
                        uniqueUrls.add(url);
                        window.open(url, '_blank');
                    }
                }
            });
        } else {
            console.error('Element #gallery-gallery not found.');
        }
    };

    const showSettingsMenu = () => {
        if (document.getElementById('settingsMenu')) return;

        const menu = createDraggableMenu('settingsMenu', {
            top: '150px',
            left: '50px',
            width: '300px',
            backgroundColor: '#222',
            color: '#FFF',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
        });

        const autoFilterToggle = document.createElement('label');
        autoFilterToggle.style.display = 'block';
        autoFilterToggle.style.marginBottom = '10px';
        autoFilterToggle.innerHTML = `
            <input type="checkbox" id="autoFilterToggle" ${settings.autoFilter ? 'checked' : ''}>
            Auto-filter posts
        `;
        autoFilterToggle.querySelector('input').addEventListener('change', (e) => {
            settings.autoFilter = e.target.checked;
            saveSettings();
            if (settings.autoFilter) filterGallery();  
        });
        menu.appendChild(autoFilterToggle);

        const fixedButtonsToggle = document.createElement('label');
        fixedButtonsToggle.style.display = 'block';
        fixedButtonsToggle.style.marginBottom = '10px';
        fixedButtonsToggle.innerHTML = `
            <input type="checkbox" id="fixedButtonsToggle" ${settings.fixedButtons ? 'checked' : ''}>
            Fix buttons on scroll
        `;
        fixedButtonsToggle.querySelector('input').addEventListener('change', (e) => {
            settings.fixedButtons = e.target.checked;
            saveSettings();
            document.querySelectorAll('button').forEach(updateFixedPosition);
        });
        menu.appendChild(fixedButtonsToggle);

        ['r-general t-image', 'r-adult t-image', 'r-mature t-image'].forEach(className => {
            const classCheckbox = document.createElement('label');
            classCheckbox.style.display = 'block';
            classCheckbox.innerHTML = `
                <input type="checkbox" value="${className}" ${settings.allowedClasses.includes(className) ? 'checked' : ''}>
                ${className.replace('t-image', '').trim()}
            `;
            classCheckbox.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    settings.allowedClasses.push(e.target.value);
                } else {
                    settings.allowedClasses = settings.allowedClasses.filter(c => c !== e.target.value);
                }
                saveSettings();
                if (settings.autoFilter) filterGallery(); 
            });
            menu.appendChild(classCheckbox);
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.marginTop = '10px';
        closeButton.style.padding = '5px 10px';
        closeButton.style.backgroundColor = '#444';
        closeButton.style.color = '#FFF';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '5px';
        closeButton.style.cursor = 'pointer';
        closeButton.addEventListener('click', () => menu.remove());
        menu.appendChild(closeButton);

        document.body.appendChild(menu);
    };

    if (settings.autoFilter) filterGallery();

    createButton('filterButton', 'Filter', {
        top: '160px',
        left: '10px',
        padding: '10px 20px',
        backgroundColor: settings.buttonColor,
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
    }, filterGallery);

    createButton('openLinksButton', 'Open Visible Links', {
        top: '210px',
        left: '10px',
        padding: '10px 20px',
        backgroundColor: '#008000',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
    }, openVisibleLinks);

    createButton('settingsButton', 'Settings', {
        top: '260px',
        left: '10px',
        padding: '10px 20px',
        backgroundColor: '#444',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
    }, showSettingsMenu);
})();
