// Startup function that causes the system to not cache AJAX calls.
$(function () {
    $.ajaxSetup({ cache: false });
});

var journey = new Journey();

// Primary journey class.
function Journey() {
    var journey = this;
    var pageLoads = [];
    var pageUnloads = [];
    var pageRefreshes = [];
    var popoutOpen = false;
    // List of journey pages that are loaded.
    var journeyPages = [];
    var pageCount = 0;
    var homePage;
    var busyOverlayTimout = 0;
    var popoutSetupFunctions = {};
    var pageIsLoading = false;
    var busyOverlayFailureTimeout = 0;  // Timeout that gets set when busy is displayed to let the user bail out.
    journey.busyOverlayFailureTimeoutInSeconds = 15;  // Timeout that gets set when busy is displayed to let the user bail out.
    var busyOverlayFailurePromptTimeout = 0;  // Timeout that gets set when busy is displayed to let the user bail out.
    journey.busyOverlayFailurePromptTimeoutInSeconds = 5;  // Timeout that gets set when busy is displayed to let the user bail out.
    var connectionBadTimeout = 0;       // Timeout for showing bad connection
    var connectionBadWaitInSeconds = 5; // Seconds to wait before showing the bad connection message
    journey.isConnected = true;
    journey.pageLoadCallback = null;  // Set this to a function to have code run every time a page is loaded.
    journey.fadeHomePageRefresh = true;  // Set to false to not fade the home page on refresh.
    var baseUrl = location.protocol + '//' + location.host + location.pathname;
    journey.updateAddressBar = true;  // If true, the address bar gets updated with the current URL to rebuild the journey.

    // Startup journey page that initializes the main page.
    $(function () {
        journey.setHeights();
        closePopout();
        $(window).resize(journey.setHeights);
        setupPopout();
    });

    // Adds a callback when the popout gets shown.
    journey.popoutSetup = function (popupId, popupSetupCallback) {
        popoutSetupFunctions[popupId] = popupSetupCallback;
    };

    // Refreshes all the displayed pages.
    journey.refresh = function () {
        refreshPages();
    };

    // Refreshes all the displayed pages.
    journey.refreshPage = function (pageName) {
        var ranScript = false;
        for (var iPage = 0; iPage < journeyPages.length; iPage++) {
            if (journeyPages[iPage].page.journeyScriptName == pageName) {
                if (journeyPages[iPage].page.runRefreshScript()) {
                    ranScript = true;
                }
                break;
            }
        }
        if (!ranScript) {
            // This page doesn't have a refresh, reload it.
            journeyPages[iPage].refreshPage();
        }
    };

    // Loads a page into the Journey framework.
    journey.pageLoad = function (pageName, pageLoadCallback) {
        for (var i in pageLoads) {
            if (pageLoads[i].pageName == pageName) {
                // Remove it
                pageLoads.splice(i, 1);
                break;
            }
        }
        pageLoads.push({ pageName: pageName, pageLoadCallback: pageLoadCallback });
    };

    // Removes a page from the Journey framework
    journey.pageUnload = function (pageName, pageUnloadCallback) {
        for (var i in pageUnloads) {
            if (pageUnloads[i].pageName == pageName) {
                // Remove it
                pageUnloads.splice(i, 1);
                break;
            }
        }
        pageUnloads.push({ pageName: pageName, pageUnloadCallback: pageUnloadCallback });
    };

    // Adds a page refresh callback to the collection.
    journey.pageRefresh = function (pageName, pageRefreshCallback) {
        for (var i in pageRefreshes) {
            if (pageRefreshes[i].pageName == pageName) {
                // Remove it
                pageRefreshes.splice(i, 1);
                break;
            }
        }
        pageRefreshes.push({ pageName: pageName, pageRefreshCallback: pageRefreshCallback });
    };

    journey.register = function (pageName, callbacks) {
        if (callbacks) {
            if (callbacks.load && $.isFunction(callbacks.load)) {
                journey.pageLoad(pageName, callbacks.load);
            }
            if (callbacks.unload && $.isFunction(callbacks.unload)) {
                journey.pageUnload(pageName, callbacks.unload);
            }
            if (callbacks.refresh && $.isFunction(callbacks.refresh)) {
                journey.pageRefresh(pageName, callbacks.refresh);
            }
        }
    };

    // Run the script callback for a page load.
    journey.runLoadScript = function (page) {
        for (var i in pageLoads) {
            if (pageLoads[i].pageName == page.journeyScriptName) {
                pageLoads[i].pageLoadCallback(page);
                break;
            }
        }
    };

    // Run the script callback for a page unload.
    journey.runUnloadScript = function (page) {
        for (var i in pageUnloads) {
            if (pageUnloads[i].pageName == page.journeyScriptName) {
                pageUnloads[i].pageUnloadCallback(page);
                break;
            }
        }
    };

    // Run the script callback for a page unload. Returns false if the page should refresh.
    journey.runRefreshScript = function (page) {
        for (var i in pageRefreshes) {
            if (pageRefreshes[i].pageName == page.journeyScriptName) {
                var returnValue = pageRefreshes[i].pageRefreshCallback(page);
                if (returnValue === undefined) return true;
                return returnValue;
            }
        }
        return false;
    };

    function splitUrl(url) {
        var result = url.split("%7C");
        if (result.length == 1) {
            result = url.split("|");
        }
        return result;
    }

    // Opens a journey page based on a URL. 
    // Element refers to the element used to open the page. This will allow the framework
    // to close pages beyond the page that was used to open this page.
    journey.openJourneyPage = function (url, element, callback, iframeWidth) {
        // Check for multiple URLs
        // See if we have more than one page to open
        var urls = splitUrl(url);
        url = urls[0];
        // Remove the first item
        urls.splice(0, 1);
        // If we still have items, create a callback to open them the next time.
        if (urls.length > 0) {
            var remainingUrls = urls.join("|");
            // Assign into a temporary variable so we can close on the original callback.
            callback = (function (finalCallback) {
                return function () {
                    journey.openJourneyPage(remainingUrls, null, finalCallback);
                };
            })(callback);
        }

        // See what we need to close.
        if ($(element).length > 0) {
            // See if this is a page and then close all the later pages.
            var parents = $(element).parents(".journey-custom-page");
            if (parents.length > 0) {
                var page = journeyPageById(parents[0].id);
                //$("#journey-main-content").width($("#journey-main-content").width());
                page.removePage(false, true, function () {
                    var page = new JourneyPage(url, callback, iframeWidth);
                });
            } else {
                // If this is on the menu or home page, close all pages.
                removeAllJourneyPages(true, function () {
                    var page = new JourneyPage(url, callback, iframeWidth);
                });
            }
        } else {
            // Just open the page.
            var page = new JourneyPage(url, callback, iframeWidth);
        }
    };

    // This allows us to rebind to the click handler on each page. 
    // It is important that we be the last handler so if anything prevents a regular
    // navigation that we honor that.
    journey.bindClickHandler = function () {
        $(document).off("click", documentClickHandler);
        $(document).on("click", documentClickHandler);
    };

    // Delegate the click event for anchors so we can redirect it.
    function documentClickHandler(e) {
        var iframeWidth;
        // If a page is already loading, don't respond.
        if (pageIsLoading) {
            return false;
        }
        e = e || window.event;
        // See if the default has been prevented, if so, quit
        if (e.isDefaultPrevented()) {
            return false;
        }

        // Get the element where the click was done.
        var element = e.target || e.srcElement;

        if (element.tagName == 'A') {
            // Only open the page if this really is a link.
            if (element.target.toLowerCase() == "_blank") {
                window.open(element.href, '_blank');
            } else if (element.href.indexOf('#') == -1) {
                iframeWidth = element.getAttribute("iframe-width");
                journey.openJourneyPage(element.href, element, null, iframeWidth);
            }
            return false; // prevent default action and stop event propagation
        } else if ($(element).parents("a").length > 0) {
            // See if there is an a this is inside.
            // Only open the page if this really is a link.
            if ($(element).parents("a")[0].target.toLowerCase() == "_blank") {
                window.open(element.href, '_blank');
            } else if ($(element).parents("a")[0].href.indexOf('#') == -1) {
                var href = $(element).parents("a")[0].href;
                iframeWidth = element.getAttribute("iframe-width");
                journey.openJourneyPage(href, element, null, iframeWidth);
            }
            return false; // prevent default action and stop event propagation

        } else if ($(element).attr("type") == "submit" && $(element).parents("form").length > 0) {
            // This is a submit button, handle it via ajax
            var form = $(element).parents("form")[0];
            // Make sure this is a good postback form
            if ($(form).attr("action")) {
                var page = journeyPageById($(element).parents("div.journey-page").attr("id"));
                var openResultantPage = $(form).attr("data-open-new-page");
                // The extra _= that jQuery appends to make requests unique so IE refreshes correctly needs to be removed.
                var url = $(form).attr("action").split("&_=")[0].split("?_=")[0];
                if (form && url) {
                    var busyTimeout = setTimeout(journey.showBusyOverlay, 200);
                    pageIsLoading = true;
                    $.post(url, $(form).serialize())
                        .done(function (result) {
                            // Determine if we got the same page back
                            if (result.indexOf("Journey Page Close") === 0) {
                                // Blank page back, close it.
                                // See if we want to refresh as well
                                if (page) {
                                    if (result.indexOf("Refresh") > -1) {
                                        page.removePage(true, false, refreshPages);
                                    } else {
                                        page.removePage(true, false);
                                    }
                                } else {
                                    // This is the home page. Just refresh.
                                    refreshPages();
                                }

                            } else if (result.trim() == "Journey Refresh") {
                                // Reload the entire UI.
                                location.reload();
                            } else if (result.trim() == "Journey Refresh Page") {
                                // Refresh the current page. Close pages to the right.
                                if (page) {
                                    page.removePage(false, true, refreshPages);
                                } else {
                                    // This is the home page
                                    removeAllJourneyPages(true, refreshPages);
                                }
                            } else if (result.replace(/&amp;/g, "&").indexOf('action="' + url + '"') > -1) {
                                // Replace the encoded ampersands above in the content coming back.
                                // Replace the content of the page.
                                if (page) {
                                    page.page.runUnloadScript();
                                    page.page.html = result;
                                    page.setContent();
                                } else {
                                    // This is the home page
                                    homePage.runUnloadScript();
                                    loadHomePageContent(result);
                                }
                            } else {
                                // Post the content as a page.'
                                // Pull the URL from the page because Journey pages have these embedded.
                                var pageUrl = getJourneyPageUrl(result);
                                openResultantPage = openResultantPage ||
                                    result.indexOf("<!-- OpenPageAfterSubmit='true' -->") >= 0;
                                if (page) {  // If this doesn't exist, it is a home page.
                                    var removeSelf = (openResultantPage ? false : true);
                                    page.removePage(removeSelf, true, function () {
                                        journey.openJourneyPage(pageUrl);
                                        refreshPages();
                                    });
                                } else {
                                    // This is the home page
                                    if (openResultantPage) {
                                        removeAllJourneyPages(true, function () {
                                            journey.openJourneyPage(pageUrl);
                                            refreshPages();
                                        });
                                    } else {
                                        removeAllJourneyPages(true);
                                        homePage.runUnloadScript();
                                        loadHomePageContent(result);
                                    }
                                }
                            }
                            journey.setHeights();
                            clearTimeout(busyTimeout);
                            journey.hideBusyOverlay();
                            pageIsLoading = false;
                        });
                    return false;
                }
            }
        }
        return true;
    }

    // Closes the page with the specified element.
    journey.closeCurrentPage = function (pageElement) {
        var page = journeyPageById($(pageElement).parents("div.journey-page").attr("id"));
        page.removePage(true, false, refreshPages);
        journey.hideBusyOverlay();
    };

    function getJourneyPageUrl(source) {
        var part1 = source.split("<!-- URL='");
        if (part1.length > 1) {
            var part2 = part1[1].split("' -->");
            return part2[0];
        }
        return "";
    }


    // Removes all the pages aside from the home page.
    function removeAllJourneyPages(suspendScrolling, callback) {
        if (journeyPages.length > 0) {
            journeyPages[0].removePage(true, suspendScrolling, callback);
        } else if (callback) {
            callback();
        }
    }


    // Gets a page from the pages collection by its id.
    function journeyPageById(pageId) {
        for (var iPage = 0; iPage < journeyPages.length; iPage++) {
            if (journeyPages[iPage].id == pageId) {
                return journeyPages[iPage];
            }
        }
        return null;
    }

    // Refresh the home page and the rest of the pages.
    function refreshPages() {
        if (!homePage.runRefreshScript()) {
            loadHomePage(homePage.url);
        }
        for (var iPage = 0; iPage < journeyPages.length; iPage++) {
            if (!journeyPages[iPage].page.runRefreshScript()) {
                // This page doesn't have a refresh, reload it.
                journeyPages[iPage].refreshPage();
            }
        }
        journey.setHeights();
    }


    // Resize the divs to work right.
    journey.setHeights = function () {
        var newHeight = $(window).innerHeight();
        // Set the initial div to the full height.
        $('#journey-shell').height(newHeight);
        // Set the full height elements to the right heights.
        $('.journey-full-height').each(function () {
            var parent = $(this).parent();
            $(this).height(parent.innerHeight());
        });
        $('.journey-parent-height').each(function () {
            var parent = $(this).parent();
            $(this).height(parent.innerHeight() - $(this).offset().top);
        });

        // Set the pages to the height of the main-content
        var mainContent = $("#journey-main-content").parent();
        $('#journey-main-content div.journey-page').each(function () {
            $(this).height(mainContent.innerHeight());
        });
        // Set the height of the padding so the hourglass is right.
        $("#journey-main-content-padding").height(mainContent.innerHeight());

        // Set the pages to at least the height of the page.
        $('#journey-main-content div.journey-page div.journey-page-content div.journey-page-body').each(function () {
            var parent = $(this).parent();
            // Calculate the height of the children that are not the body
            var siblingHeight = 0;
            $(this).parent().siblings(':not(script, style)').each(function () {
                siblingHeight += $(this).height();
            });
            $(this).siblings(':not(script, style)').each(function () {
                siblingHeight += $(this).height();
            });
            // Set the minimul height of the body area.
            //-$("#journey-main-content").scrollBarHeight()
            var scrollBarHeight = 10;
            if ($("#journey-main-content").hasScrollBar()) {
                scrollBarHeight += 17;
            }
            $(this).css("height", (parent.parent().innerHeight() - siblingHeight - scrollBarHeight) + 'px');
        });
    };

    journey.scrollTo = function (element, animationTime) {
        animationTime = animationTime || 400;
        var location = $('#journey-main-content').scrollLeft() + $(element).position().left + $(element).width() - 50 - $("#journey-main-content").width();
        $('#journey-main-content').scrollTo({ left: location, top: 0 }, animationTime);
    };

    journey.currentUrl = function () {
        var urls = [];
        $.each(journeyPages, function (i, page) {
            // see if the first part of the URL matches regardless of case
            var url = page.url;
            if (url.toLowerCase().indexOf(baseUrl.toLowerCase()) >= 0) {
                url = '~' + url.slice(baseUrl.length);
            }
            urls.push(encodeURIComponent(url));
        });

        var result = baseUrl + "?home=" + encodeURIComponent(homePage.url);
        if (urls.length > 0 ) result += "&urls=" + urls.join('|');
        return result;
    }

    // This only works if updateAddressBar == true;
    journey.updateCurrentUrl = function () {
        if (journey.updateAddressBar) {
            // push the page to the history so we can go back.
            var currentPage = journeyPages[journeyPages.length - 1];
            if (currentPage) {
                window.history.pushState({}, currentPage.title, journey.currentUrl());
            } else {
                window.history.pushState({}, "Home", journey.currentUrl());
            }
        }
    }

    function setupPopout() {
        // Set the LIs to open it.
        $('#journey-side-bar li').click(function () {
            var contentId = $(this).attr('data-content-id');
            var homeContentUrl = $(this).attr('data-home-content-url');
            if (contentId) {
                showPopout(contentId);
            } else if (homeContentUrl) {
                // Load a new home page
                closePopout();
                removeAllJourneyPages();
                loadHomePage(homeContentUrl);
            } else {
                // Close the popout, this has no content.
                closePopout();
            }
        });
        // Clicking on the main content should close the popout
        $('#journey-main-content').click(closePopout);

        // Set the close button
        $('#journey-popout div.journey-popout-control div.journey-popout-close').click(closePopout);
    }

    //Show the specified pop out.
    function showPopout(contentId) {
        // Find the original element

        // Fill the content of the popout based on the id
        $('#journey-popout div.journey-inner-content').html($('#' + contentId).html());
        // Set the title from the name of the li.
        $('#journey-popout div.journey-popout-title').html($('[data-content-id="' + contentId + '"]').children('.journey-title').html());
        // Call a method for setting up the popout
        if (popoutSetupFunctions[contentId]) {
            popoutSetupFunctions[contentId]();
        }
        if (!popoutOpen) {
            openPopout();
        } else {
            closePopout();
        }
    }

    // Expose this externally.
    journey.showPopout = showPopout;


    // Reload the home page from a URL.
    function loadHomePage(url) {
        if (homePage) {
            homePage.runUnloadScript();
        }

        // Load the new page.
        homePage = new Page(url, function () {
            // Hide the one showing.
            var targetOpacity = 0.5;
            if (!journey.fadeHomePageRefresh) {
                targetOpacity = 1;
            }
            $('#journey-home-area').animate({
                opacity: targetOpacity
            }, 300, function () {
                // Put the HTML on the page and run the load script.
                loadHomePageContent(homePage.html);

                // Fade it back in.
                $('#journey-home-area').animate({
                    opacity: 1
                }, 300);
                if (homePage.issues.length > 0) {
                    alert("Errors loading the page.");
                }
                journey.updateCurrentUrl();
            });

        });
    }

    // Publically expose loadHomePage
    journey.loadHomePage = loadHomePage;

    // Set the content on the home page and run the load script.
    function loadHomePageContent(content) {
        // Load the page into the home container
        $('#journey-home-area').html(content);
        homePage.id = "journey-home-area";
        // Run the load script.
        homePage.runLoadScript();
    }



    function openPopout() {
        $('#journey-popout').show();
        // If this has been hidden, it needs to be refreshed.
        journey.setHeights();
        $('#journey-popout').animate({
            width: 500
        }, 100, function () {
            popoutOpen = true;
            // Animation Complete
            journey.bindClickHandler();
        });
    }

    function closePopout() {
        if (popoutOpen) {
            $('#journey-popout').animate({
                width: 0
            }, 100, function () {
                // Animation Complete
                $('#journey-popout').hide();
                popoutOpen = false;
            });
        }
    }

    journey.showBusy = function () {
        $('#journey-busy-indicator').fadeIn(100);
        journey.scrollTo('#journey-busy-indicator');
        journey.setHeights();
        clearTimeout(busyOverlayFailureTimeout);
        busyOverlayFailureTimeout = setTimeout(busyFailed, journey.busyOverlayFailureTimeoutInSeconds * 1000);
    };

    journey.hideBusy = function () {
        clearTimeout(busyOverlayFailureTimeout);
        $('#journey-busy-indicator').fadeOut(100);
    };

    journey.showBusyOverlay = function () {
        // Wait for 200 MS before showing the busy indicator.
        if (busyOverlayTimout === 0) {
            busyOverlayTimout = setTimeout(showBusyOverlayAfterDelay, 200);
        }
    };

    function showBusyOverlayAfterDelay() {
        $('#journey-busy-overlay').fadeIn(100);
        journey.setHeights();
        clearTimeout(busyOverlayFailureTimeout);
        busyOverlayFailureTimeout = setTimeout(busyFailed, journey.busyOverlayFailureTimeoutInSeconds * 1000);
    }

    function busyFailed() {
        // Something probably went wrong, so we need to refresh the browser
        // TODO: Add a feature to allow the user to stop the failure refresh.
        // Remove them, but don't hide to eliminate the text from jumping.
        $('#refresh-on-the-way').hide();
        $('#refresh-now').fadeTo(0, 0.01);
        $('#refresh-cancel').fadeTo(0, 0.01);
        // Fade the overlay in with the buttons.
        $('#busy-fail-overlay').fadeIn(500, function () {
            $('#refresh-now').fadeTo(500, 100);
            $('#refresh-cancel').fadeTo(500, 100);
        });
        // Handlers for cancel and reload.
        $('#refresh-now').click(function () {
            $('#refresh-now').hide();
            $('#refresh-cancel').hide();
            $('#refresh-on-the-way').show();
            reloadWithWarning();
        });
        $('#refresh-cancel').click(function () {
            clearTimeout(busyOverlayFailurePromptTimeout);
            $('#busy-fail-overlay').fadeOut(300);
        });
        // The regular timeout for reload of the page.
        busyOverlayFailurePromptTimeout = setTimeout(function () {
            // Reload the page.
            $('#refresh-now').hide();
            $('#refresh-cancel').hide();
            $('#refresh-on-the-way').show();
            reloadWithWarning();
        }, journey.busyOverlayFailurePromptTimeoutInSeconds * 1000);
    }

    function reloadWithWarning() {
        location.reload();
        setTimeout(function () {
            $('#busy-fail-overlay').fadeTo(300, 0.5, function () {
                alert("Shucks!\nThe site is unable to reload. This could mean the site is down.\n\nYour best bet is to contact an administrator.\nYou can also try to reload the site by pressing the F5 key.");
            });
        }, 10000);
    }

    journey.hideBusyOverlay = function () {
        clearTimeout(busyOverlayTimout);
        clearTimeout(busyOverlayFailureTimeout);
        busyOverlayTimout = 0;
        $('#journey-busy-overlay').fadeOut(100);
    };

    // Call this if an underlying connection failed. 
    // This will show the user that there are connection problems.
    journey.connectionBad = function (immediate) {
        if (journey.isConnected) {
            if (immediate) {
                setConnectionBad();
            } else if (connectionBadTimeout === 0) {
                connectionBadTimeout = setTimeout(function () {
                    setConnectionBad();
                }, connectionBadWaitInSeconds * 1000);
            }
        }
    };

    journey.connectionGood = function () {
        if (!journey.isConnected) {
            setConnectionGood();
        }
    };

    function setConnectionGood() {
        journey.isConnected = true;
        clearTimeout(connectionBadTimeout);
        connectionBadTimeout = 0;
        $("#bad-connection-indicator").slideUp();
    }

    function setConnectionBad() {
        journey.isConnected = false;
        clearTimeout(connectionBadTimeout);
        connectionBadTimeout = 0;
        $("#bad-connection-indicator").slideDown();
    }

    // Do all the loading stuff after a short delay.
    setTimeout(function() {
        // Load the home page from the url
        var queryStringHome = getParameterByName('home');
        if (queryStringHome) {
            queryStringHome = decodeURIComponent(queryStringHome);
            queryStringHome = queryStringHome.replace(/~/g, baseUrl);
            journey.loadHomePage(queryStringHome);
        } else {
            // Click the default side-bar to bring up the home page.
            $("#journey-side-bar li.journey-default").click();
        }

        // Load the pages from the URL.
        var queryStringUrls = getParameterByName('urls');
        if (queryStringUrls) {
            queryStringUrls = decodeURIComponent(queryStringUrls);
            queryStringUrls = queryStringUrls.replace(/~/g, baseUrl);
            journey.openJourneyPage(queryStringUrls);
        }
    }, 100);





    function JourneyPage(urlOrContent, callback, iframeWidth) {
        var selfJourneyPage = this;
        selfJourneyPage.url = "Unknown";
        selfJourneyPage.title = "Unknown";

        // Did we get a url or a full page?
        if (urlOrContent.indexOf('<body>') > -1 || urlOrContent.indexOf('<div>') > -1) {
            selfJourneyPage.page = new Page(urlOrContent, insertPage);
        } else {
            selfJourneyPage.url = urlOrContent;
            selfJourneyPage.page = new Page(urlOrContent, insertPage, iframeWidth);
        }

        // Inserts the html page into the journey.
        function insertPage() {
            if (selfJourneyPage.page.html) {
                selfJourneyPage.id = 'journey-page-' + selfJourneyPage.page.index;
                selfJourneyPage.page.id = selfJourneyPage.id;
                selfJourneyPage.title =
                journeyPages.push(selfJourneyPage);
                // Get the template
                var pageHtml = $($("#journey-page-template").html());
                // Set the ID of the page
                // Insert the content in the page.
                pageHtml.attr('id', selfJourneyPage.id);
                pageHtml.children('div.journey-page-content').html(selfJourneyPage.page.html);


                // Insert the page into the main content area.
                //$('#journey-main-content').append(pageHtml);
                pageHtml.insertBefore('#journey-main-content-padding');
                // Make sure this height is set right.
                journey.setHeights();
                // Run the page startup scripts.
                selfJourneyPage.page.runLoadScript();

                // Calcualte the ideal widths.
                var width = pageHtml.width();
                if (width == 304) width = 600;
                // Set the width to 0 so we can expand it.
                pageHtml.width(0);

                // Set up the close button
                selfJourneyPage.LinkCloseButton();

                // Show the page.
                pageHtml.show();
                pageHtml.animate({
                    width: width
                }, 200, function () {
                    // Animation Complete
                    journey.scrollTo(pageHtml);

                    if ($.isFunction(journey.pageLoadCallback)) {
                        journey.pageLoadCallback();
                    }
                    // Do the callback once the page is shown.
                    if (callback) {
                        callback();
                    }
                });
            }
            journey.updateCurrentUrl();
        }

        // Refreshes the page.
        selfJourneyPage.refreshPage = function () {
            selfJourneyPage.page.runUnloadScript();
            selfJourneyPage.page.loadPageFromUrl(selfJourneyPage.setContent);
        };

        // Sets the DOM to have the value in .html.
        selfJourneyPage.setContent = function () {
            // Callback once the page is loaded.
            var pageHtml = $("#" + selfJourneyPage.id);
            pageHtml.children('div.journey-page-content').html(selfJourneyPage.page.html);
            journey.setHeights();
            selfJourneyPage.LinkCloseButton();
            selfJourneyPage.page.runLoadScript();
        };

        selfJourneyPage.LinkCloseButton = function () {
            // Link up to the close button.
            $('#' + selfJourneyPage.id + ' div.journey-page-control div.journey-tool-close').click(function () {
                selfJourneyPage.removePage(true);
            });
        };

        // Removes a page.
        selfJourneyPage.removePage = function (removeSelf, suppressScroll, removeCallback) {
            var iPage;
            if (!suppressScroll) {
                // Scroll to the right page.
                var pageToScrollTo;
                if (removeSelf) {
                    pageToScrollTo = homePage;
                    for (iPage = 0; iPage < journeyPages.length; iPage++) {
                        if (journeyPages[iPage] == selfJourneyPage) {
                            break;
                        }
                        pageToScrollTo = journeyPages[iPage].page;
                    }
                } else {
                    pageToScrollTo = selfJourneyPage.page;
                }
                journey.scrollTo($("#" + pageToScrollTo.id));
                //$('#journey-main-content').scrollTo({ top: 0, left: $("#" + pageToScrollTo.id).position().left }, 400);
            }

            // Remove any pages to the right.
            // Create a list of pages to remove.
            var pagesToRemove = [];
            for (iPage = journeyPages.length - 1; iPage >= 0; iPage--) {
                var page = journeyPages[iPage];
                if (page == selfJourneyPage) {
                    if (removeSelf) {
                        pagesToRemove.push(page);
                    }
                    break;
                }
                pagesToRemove.push(page);
            }
            pagesToRemove.reverse();
            removePages(pagesToRemove, removeCallback);
        };

        // Removes a number of pages recursively with an animation.
        function removePages(pagesToRemove, removePagesCallback) {
            if (pagesToRemove && pagesToRemove.length > 0) {
                var page = pagesToRemove[0];
                selfJourneyPage.page.runUnloadScript();

                $('#' + page.id).animate({
                    opacity: 0
                }, 200, function () {
                    // Animation Complete
                    // remove the page
                    $('#' + page.id).remove();
                    pagesToRemove.splice(0, 1);
                    journeyPages.splice(journeyPages.indexOf(page), 1);
                    if (pagesToRemove.length > 0) {
                        removePages(pagesToRemove, removePagesCallback);
                    } else if (removePagesCallback) {
                        removePagesCallback();
                    }
                    journey.updateCurrentUrl();
                });
            } else if (removePagesCallback) {
                removePagesCallback();
            }
        }
    }


    function Page(urlOrContent, callback, iframeWidth) {
        var selfPage = this;
        selfPage.url = "Unknown";
        selfPage.html = "";
        selfPage.index = ++pageCount;  //Unique Identifier
        selfPage.scripts = [];
        selfPage.issues = [];
        selfPage.journeyScriptName = null;
        selfPage.id = ""; // This will be set later.
        selfPage.desiredIframeWidth = iframeWidth;

        // Loads the page from the server and adds it to the journey
        selfPage.loadPageFromUrl = function (loadPageCallback) {
            var timeout = setTimeout(journey.showBusy, 200);
            var actualIframeWidth = selfPage.desiredIframeWidth || "600px";
            if (selfPage.desiredIframeWidth) {
                // This must return before the page can be loaded. 
                setTimeout(function () {
                    // Set up the iframe.
                    selfPage.html = '<iframe src="' + selfPage.url + '" style="width: ' + actualIframeWidth + '; height: 100%;" frameborder="0"></iframe>';
                    clearTimeout(timeout);
                    journey.hideBusy();
                    loadPageCallback();
                    journey.bindClickHandler();
                }, 10);
            } else {
                $.ajax(selfPage.url, {
                    dataType: 'html',
                    xhrFields: {
                        withCredentials: true
                    }
                }).done(function (html) {
                    // Make sure this is not JSON for some reason
                    if (html.indexOf("{") === 0) {
                        // This is JSON for some strange reason, throw it out
                    } else {
                        // Load the page into the journey
                        selfPage.html = html;
                        var thisPageContent = $(selfPage.html).filter("[data-journey-script]");

                        if (thisPageContent.length > 0) {
                            selfPage.journeyScriptName = thisPageContent.attr("data-journey-script");
                        }
                    }
                }).fail(function (ex) {
                    // Try to load an IFrame
                    selfPage.html = '<iframe src="' + selfPage.url + '" style="width: ' + actualIframeWidth + '; height: 100%;" frameborder="0"></iframe>';
                    //alert("Could not load the page");
                }).always(function () {
                    // Clear the busy and timeout
                    clearTimeout(timeout);
                    journey.hideBusy();
                    loadPageCallback();
                    // Disable page elements as necessary
                    $('.disable-form input:not(.allow-disabled-click):not([type="hidden"]), ' +
                        ".disable-form textarea:not(.allow-disabled-click), " +
                        ".disable-form .form-control:not(.allow-disabled-click), " +
                        ".disable-form button:not(.allow-disabled-click), " +
                        ".disable-form .select2-container:not(.allow-disabled-click)").attr('disabled', 'disabled');
                    journey.bindClickHandler();

                });
            }
        };


        selfPage.runLoadScript = function () {
            if (selfPage.journeyScriptName) {
                journey.runLoadScript(selfPage);
            }
        };
        selfPage.runUnloadScript = function () {
            if (selfPage.journeyScriptName) {
                journey.runUnloadScript(selfPage);
            }
        };


        // Runs the refresh script for the page. If the script was found, and run it returns true. 
        // If no script was found return false. This way the page can be reloaded.
        selfPage.runRefreshScript = function () {
            if (selfPage.journeyScriptName) {
                return journey.runRefreshScript(selfPage);
            }
            return false;
        };

        selfPage.element = function () {
            return $("#" + selfPage.id)[0];
        };

        // These are the methods that get called in the constructor.
        // They have to be down here so that all the public functions are available.
        if (urlOrContent.indexOf('<body>') > -1 || urlOrContent.indexOf('<div>') > -1) {
            selfPage.html = urlOrContent;
            var journeyScriptElement = $(selfPage.html).filter("[data-journey-script]");
            if (journeyScriptElement.length > 0) {
                selfPage.journeyScriptName = journeyScriptElement.attr("data-journey-script");
            }
            setTimeout(callback, 10);
        } else {
            selfPage.url = urlOrContent;
            selfPage.loadPageFromUrl(callback);
        }

    }


}



// Utility to determine if there are scroll bars on an element and how big they are.
(function ($) {
    $.fn.hasScrollBar = function () {
        return this.height() > this.get(0).clientHeight;
    };
})(jQuery);

(function ($) {
    $.fn.scrollBarHeight = function () {
        return this.height() - this.get(0).clientHeight;
    };
})(jQuery);


// Add a shim for the scrollTo jQuery plugin just in case it fails to load.
if (!$(window).scrollTo) {
    (function ($) {
        $.fn.scrollTo = function (target, duration, settings) {
            this.animate({
                scrollLeft: target.left
            }, 350);
            this.animate({
                scrollTop: target.top
            }, 350);
            return this;
        };
    }(jQuery));
}


// http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}