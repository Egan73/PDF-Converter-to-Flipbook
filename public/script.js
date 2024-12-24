let pdfDoc = null,
    pageNum = 1,
    canvasLeft = document.getElementById('pdf-render-left'),
    canvasRight = document.getElementById('pdf-render-right'),
    ctxLeft = canvasLeft.getContext('2d'),
    ctxRight = canvasRight.getContext('2d'),
    isSinglePageView = true;  // Start with single page view

// Function to render the flipbook based on current view (single or double page)
function renderPages() {
    if (isSinglePageView) {
        renderSinglePage(pageNum);   // Render a single centered page initially
    } else {
        renderPageLeft(pageNum);     // Render left page (odd-numbered)
        renderPageRight(pageNum + 1); // Render right page (even-numbered)
    }
}

// Render a single page in the center
function renderSinglePage(pageNum) {
    clearCanvas(ctxRight, canvasRight);  // Hide the right canvas
    canvasRight.style.display = 'none';  // Hide right canvas visually

    renderPageLeft(pageNum);             // Use left canvas for single page display
    canvasLeft.style.display = 'block';  // Ensure the left canvas is visible
}

// Render the left (odd-numbered) page
function renderPageLeft(pageNum) {
    if (pageNum > pdfDoc.numPages) {
        clearCanvas(ctxLeft, canvasLeft);
        return;
    }

    pdfDoc.getPage(pageNum).then(function(page) {
        const viewport = page.getViewport({ scale: 1.5 });
        canvasLeft.height = viewport.height;
        canvasLeft.width = viewport.width;

        const renderContext = {
            canvasContext: ctxLeft,
            viewport: viewport
        };

        page.render(renderContext);
    });
}

// Render the right (even-numbered) page
function renderPageRight(pageNum) {
    if (pageNum > pdfDoc.numPages) {
        clearCanvas(ctxRight, canvasRight);
        return;
    }

    pdfDoc.getPage(pageNum).then(function(page) {
        const viewport = page.getViewport({ scale: 1.5 });
        canvasRight.height = viewport.height;
        canvasRight.width = viewport.width;

        const renderContext = {
            canvasContext: ctxRight,
            viewport: viewport
        };

        page.render(renderContext);
    });
}

// Clears the canvas when no more pages exist
function clearCanvas(context, canvas) {
    context.clearRect(0, 0, canvas.width, canvas.height);
}

document.getElementById('upload-btn').addEventListener('click', function() {
    const fileInput = document.getElementById('pdf-upload');
    const files = fileInput.files;

    if (files.length > 0) {
        handleFiles(files);
    } else {
        alert('Please select a PDF file first.');
    }
});


// Define your animation duration
const flipAnimationDuration = 1300;  // Total duration of the flip animation in milliseconds

// "Next Page" button
document.getElementById('next-page').addEventListener('click', function() {
    if (isSinglePageView) {
        isSinglePageView = false;
        pageNum = 2;  // Start at the second page for two-page view
        canvasRight.style.display = 'block';  // Show the right canvas
    } else if (pageNum < pdfDoc.numPages - 1) {
        pageNum += 2;  // Move forward by two pages
    }

    // Start the flip animation
    canvasRight.classList.add('flip-left');  // Begin flip animation

    // Render the right page immediately when the flip animation starts
    renderPageRight(pageNum);  // Render the right page during the flip

      // Midpoint delay to change page content halfway through the flip
      setTimeout(function() {
        renderPageRight(pageNum);  // Render the right page in the middle of the flip
    },200);  // Adjust this duration to half of your flip animation time (e.g., if full flip is 1500ms)

    // Remove the animation class after the full duration
    setTimeout(function() {
        canvasRight.classList.remove('flip-left');  // Reset animation class
        renderPages();  // Ensure both pages are correctly rendered after animation
    }, flipAnimationDuration);
});

// "Previous Page" button
document.getElementById('prev-page').addEventListener('click', function() {
    if (pageNum <= 1) return;

    const prevPageNum = pageNum - 1;
    if (pageNum === 2) {
        isSinglePageView = true;
        pageNum = 1;
        canvasRight.style.display = 'none';
    } else {
        pageNum -= 2;
    }

    // Start the flip animation
    canvasLeft.classList.add('flip-left-to-right-front');  // Begin flip animation

    // Render the left page immediately when the flip animation starts
    renderPageLeft(prevPageNum);  // Render the left page during the flip

     // Midpoint delay to change page content halfway through the flip
     setTimeout(function() {
        renderPageLeft(prevPageNum);  // Render the left page in the middle of the flip
    }, 200);  // Adjust this to half of your flip animation duration (e.g., if full flip is 880ms)

    // Remove the animation class after the full duration
    setTimeout(function() {
        canvasLeft.classList.remove('flip-left-to-right-front');  // Reset animation class
        renderPages();  // Ensure both pages are correctly rendered after animation
    }, flipAnimationDuration);
});


// Handle PDF upload and display
function handleFiles(files) {
    const file = files[0];
    if (file && file.type === 'application/pdf') {
        const formData = new FormData();
        formData.append('file', file);

        // Show loading spinner
        document.getElementById('loading-spinner').style.display = 'block';

        fetch('/uploads', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('flipbook-container').style.display = 'block';
                const fileUrl = `/uploads/${data.filename}`;
                
                pdfjsLib.getDocument(fileUrl).promise.then(function(pdf) {
                    pdfDoc = pdf;  // Assign the loaded PDF to pdfDoc
                    pageNum = 1;   // Start from the first page
                    isSinglePageView = true;  // Start in single-page view
                    canvasRight.style.display = 'none';  // Hide right canvas initially
                    renderPages(); // Render the pages

                    // Set the embed code in the textarea
                    const embedCode = `<iframe src="${fileUrl}" width="600" height="400" style="border: none;"></iframe>`;
                    document.getElementById('embed-code').value = embedCode;

                    // Hide loading spinner after flipbook is ready
                    document.getElementById('loading-spinner').style.display = 'none';
                });
            } else {
                alert('Error processing PDF.');
                document.getElementById('loading-spinner').style.display = 'none'; // Hide loading spinner on error
            }
        })
        .catch(error => {
            console.error('Error uploading file:', error);
            document.getElementById('loading-spinner').style.display = 'none'; // Hide loading spinner on error
        });
    } else {
        alert('Please upload a valid PDF file.');
    }
}

// Handle Embed button click
document.getElementById('embed-btn1').addEventListener('click', function() {
    const embedForm = document.getElementById('embed-form');
    
    // Toggle the display of the embed form
    embedForm.style.display = embedForm.style.display === 'none' || embedForm.style.display === '' ? 'block' : 'none';
});

// Handle Copy Embed Code button click
document.getElementById('get-embed-code-btn').addEventListener('click', function() {
    const embedCodeTextarea = document.getElementById('embed-code');
    embedCodeTextarea.select();
    document.execCommand('copy'); // Copy the embed code to clipboard
    alert('Embed code copied to clipboard!');
});
