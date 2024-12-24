function validateDate() {
    const yearInput = document.getElementById("year").value;
    const monthInput = document.getElementById("month").value;
    const dayInput = document.getElementById("day").value;

    const year = parseInt(yearInput, 10);
    const month = parseInt(monthInput, 10) - 1;
    const day = parseInt(dayInput, 10);

    // Tạo date theo UTC
    const inputDate = new Date(Date.UTC(year, month, day));
    const isValid =
        inputDate.getUTCFullYear() === year &&
        inputDate.getUTCMonth() === month &&
        inputDate.getUTCDate() === day;

    let result = "";
    if (!isValid) {
        result = `Ngày không hợp lệ. Vui lòng nhập lại.`;
    } else {
        // Format date theo ISO string
        const formattedDate = inputDate.toISOString().split('T')[0];
        result = `Các ảnh chụp trong ngày ${formattedDate}.`;
        update_library(formattedDate);
    }
    document.getElementById("result").textContent = result;
}

async function update_library(substring) {
    if (!substring) {
        document.getElementById("gallery").textContent = "Vui lòng nhập ngày hợp lệ.";
        return;
    }
    try {
        const response = await fetch(`/history_image?substring=${encodeURIComponent(substring)}`);
        if (!response.ok) {
            throw new Error(`Lỗi khi tải ảnh: ${response.status}`);
        }

        const images = await response.json();
        const galleryDiv = document.getElementById("gallery");
        galleryDiv.innerHTML = "";

        if (images.length === 0) {
            galleryDiv.textContent = "Không tìm thấy ảnh.";
            return;
        }

        images.forEach(image => {
            const imageItem = document.createElement("div");
            imageItem.className = "image-item";

            
            // Tạo element cho ảnh
            const imgElement = document.createElement("img");
            
            // Sử dụng trực tiếp dữ liệu Base64 từ MongoDB
            imgElement.src = `data:${image.contentType};base64,${image.data}`;
            
            // Thêm style cho ảnh
            imgElement.style.maxWidth = '300px';
            imgElement.style.height = 'auto';
            
            const caption = document.createElement("p");
            caption.textContent = image.filename;

            imageItem.appendChild(imgElement);
            imageItem.appendChild(caption);
            galleryDiv.appendChild(imageItem);
        });
    } catch (error) {
        console.error(error);
        document.getElementById("gallery").textContent = "Đã xảy ra lỗi khi tải ảnh.";
    }
}