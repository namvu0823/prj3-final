function validateDate() {
    const yearInput = document.getElementById("year").value;
    const monthInput = document.getElementById("month").value;
    const dayInput = document.getElementById("day").value;

    const year = parseInt(yearInput, 10);
    const month = parseInt(monthInput, 10) - 1; // Months in JS start from 0
    const day = parseInt(dayInput, 10);

    // Create date at start of the day in local timezone
    const inputDate = new Date(year, month, day);
    inputDate.setHours(0, 0, 0, 0);
    
    const isValid = !isNaN(inputDate.getTime());

    let result = "";
    if (!isValid) {
        result = `The entered date is not valid. Please enter a correct date.`;
    } else {
        // Format as timestamp for consistent comparison
        const timestamp = inputDate.getTime();
        result = `Searching for images on ${inputDate.toLocaleDateString()}`;
        update_library(timestamp);
    }

    document.getElementById("result").textContent = result;
}

async function update_library(timestamp) {
    try {
        const response = await fetch(`/history_image?substring=${timestamp}`);
        if (!response.ok) {
            throw new Error(`Error fetching images: ${response.status}`);
        }

        const images = await response.json();
        const galleryDiv = document.getElementById("gallery");
        galleryDiv.innerHTML = "";

        if (images.length === 0) {
            galleryDiv.textContent = "No images found for this date.";
            return;
        }

        images.forEach(image => {
            // Convert binary data to image
            const imageItem = document.createElement("div");
            imageItem.className = "image-item";

            const imgElement = document.createElement("img");
            // Convert binary data to base64
            const base64Image = btoa(
                new Uint8Array(image.data.buffer)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            imgElement.src = `data:${image.contentType};base64,${base64Image}`;
            imgElement.alt = new Date(image.filename).toLocaleString();

            const caption = document.createElement("p");
            caption.textContent = new Date(image.filename).toLocaleString();

            imageItem.appendChild(imgElement);
            imageItem.appendChild(caption);
            galleryDiv.appendChild(imageItem);
        });
    } catch (error) {
        console.error('Error:', error);
        document.getElementById("gallery").textContent = "An error occurred while fetching images.";
    }
}