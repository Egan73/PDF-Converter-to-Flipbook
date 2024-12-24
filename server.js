const express = require('express');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
app.use(express.static('public'));  // Serve the public folder
app.use(express.json());

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'flipbook_db'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Database');
});

// Multer configuration for file uploads (saving in public/uploads)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Save the uploaded files in the "uploads" directory inside "public"
        cb(null, path.join(__dirname, 'public', 'uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Route for uploading PDF (with upload_date)
app.post('/uploads', upload.single('file'), (req, res) => {
    const filename = req.file.filename;
    const filepath = `/uploads/${filename}`;
    const baseName = filename.replace('.pdf', ''); // Get the base name without extension
    const thumbnailBasePath = path.join(__dirname, 'public', 'uploads', baseName); // Base path without extension
    
    const currentDate = new Date(); // Get current date and time

    // Insert the uploaded file info into the database along with upload_date
    const query = 'INSERT INTO history (filename, filepath, upload_date) VALUES (?, ?, ?)';
    db.query(query, [filename, filepath, currentDate], (err, result) => {
        if (err) throw err;

        // Generate the thumbnail from the PDF
        const cmd = `pdftoppm ${path.join(__dirname, 'public', 'uploads', filename)} ${thumbnailBasePath} -png -f 1 -l 1`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return res.status(500).json({ success: false, error: 'Thumbnail generation failed' });
            }

            // Handle generated thumbnail with both -01 and -1 suffixes
            const generatedThumbnailPaths = [
                `${thumbnailBasePath}-01.png`,  // Check for -01.png
                `${thumbnailBasePath}-1.png`    // Check for -1.png
            ];
            const finalThumbnailPath = `${thumbnailBasePath}.png`; // Desired output (e.g., file.png)

            // Check for both -01 and -1 suffixes and rename accordingly
            for (let generatedThumbnailPath of generatedThumbnailPaths) {
                if (fs.existsSync(generatedThumbnailPath)) {
                    fs.rename(generatedThumbnailPath, finalThumbnailPath, (err) => {
                        if (err) {
                            console.error('Error renaming thumbnail:', err);
                            return res.status(500).json({ success: false });
                        }
                        console.log(`Thumbnail renamed to ${finalThumbnailPath}`);
                    });
                    break; // Exit loop once the file is renamed
                }
            }

            console.log(`Thumbnail generated at ${finalThumbnailPath}`);
            res.json({ success: true, filename });
        });
    });
});

// Route for fetching upload history
app.get('/history', (req, res) => {
    const query = 'SELECT * FROM history';
    db.query(query, (err, results) => {
        if (err) throw err;
          // Modify filepaths to be accessible URLs
          const updatedResults = results.map(file => ({
            ...file,
            filepath: `/uploads/${file.filename}` // Assuming this is where the PDFs are stored
        }));
        res.json(results);
    });
});


app.post('/edit-file/:id', (req, res) => {
    const fileId = req.params.id;
    let newFilename = req.body.newFilename;

    // Ensure the new filename has a .pdf extension
    if (!newFilename.endsWith('.pdf')) {
        newFilename += '.pdf'; // Automatically append .pdf if not present
    }

    // Fetch the file information from the database
    const query = 'SELECT * FROM history WHERE id = ?';
    db.query(query, [fileId], (err, results) => {
        if (err) return res.json({ success: false, error: 'Database error' });
        if (results.length === 0) return res.json({ success: false, error: 'File not found' });

        const file = results[0];
        const oldFilePath = path.join(__dirname, 'public', 'uploads', file.filename);
        const oldThumbnailPath = path.join(__dirname, 'public', 'uploads', file.filename.replace('.pdf', '.png')); // Thumbnail file

        const newFilePath = path.join(__dirname, 'public', 'uploads', newFilename);
        const newThumbnailPath = path.join(__dirname, 'public', 'uploads', newFilename.replace('.pdf', '.png')); // New thumbnail file

        // Check if PDF file exists before renaming
        if (!fs.existsSync(oldFilePath)) {
            return res.json({ success: false, error: 'PDF file does not exist' });
        }

        // Rename the PDF file
        fs.rename(oldFilePath, newFilePath, (err) => {
            if (err) return res.json({ success: false, error: 'Error renaming PDF file' });

            // Check if the thumbnail file exists and rename it
            if (fs.existsSync(oldThumbnailPath)) {
                fs.rename(oldThumbnailPath, newThumbnailPath, (err) => {
                    if (err) return res.json({ success: false, error: 'Error renaming thumbnail file' });
                    console.log(`Thumbnail renamed to ${newThumbnailPath}`);
                });
            }

            // Update the database with the new filename and filepath
            const updateQuery = 'UPDATE history SET filename = ?, filepath = ? WHERE id = ?';
            db.query(updateQuery, [newFilename, `/uploads/${newFilename}`, fileId], (err) => {
                if (err) return res.json({ success: false, error: 'Database update failed' });

                res.json({ success: true });
            });
        });
    });
});



// Endpoint to delete file
app.delete('/delete-file/:id', (req, res) => {
    const fileId = req.params.id;

    // Find the file by ID and delete it
    const query = 'SELECT * FROM history WHERE id = ?';
    db.query(query, [fileId], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.json({ success: false });

        const file = results[0];
        const filePath = path.join(__dirname, 'public', 'uploads', file.filename);

        // Delete the file from the filesystem
        fs.unlink(filePath, (err) => {
            if (err) throw err;

            // Delete the file entry from the database
            const deleteQuery = 'DELETE FROM history WHERE id = ?';
            db.query(deleteQuery, [fileId], (err) => {
                if (err) throw err;
                res.json({ success: true });
            });
        });
    });
});

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
