function validateDate() {
    const yearInput = document.getElementById("year").value;
    const monthInput = document.getElementById("month").value;
    const dayInput = document.getElementById("day").value;

    const year = parseInt(yearInput, 10);
    const month = parseInt(monthInput, 10) - 1; // Tháng trong JS bắt đầu từ 0
    const day = parseInt(dayInput, 10);

    // Kiểm tra ngày hợp lệ
    const inputDate = new Date(year, month, day);
    const isValid =
        inputDate.getFullYear() === year &&
        inputDate.getMonth() === month &&
        inputDate.getDate() === day;

    let result = "";
    if (!isValid) {
        result = `The entered date is not valid. Please enter a correct date.`;
    } else {
        const formattedDate = inputDate.toISOString().split('T')[0];
        result = `The date ${formattedDate} is valid.`;
        update_library(formattedDate);
    }

    document.getElementById("result").textContent = result;
}



async function update_library(substring) {
    if (!substring) {
        document.getElementById("library").textContent = "Please enter a valid search term.";
        return;
    }
    try {
        // Gửi yêu cầu GET đến endpoint với tham số substring
        const response = await fetch(`/history_image?substring=${encodeURIComponent(substring)}`);
        if (!response.ok) {
            throw new Error(`Error fetching images: ${response.status}`);
        }

        const images = await response.json();
        const galleryDiv = document.getElementById("gallery");
        galleryDiv.innerHTML = ""; // Xóa nội dung cũ

        if (images.length === 0) {
            galleryDiv.textContent = "No images found.";
            return;
        }

        images.forEach(image => {
            // Tạo phần tử hiển thị ảnh
            const imageItem = document.createElement("div");
            imageItem.className = "image-item";

            const imgElement = document.createElement("img");
            imgElement.src = image.url; // URL của ảnh
            imgElement.alt = image.filename;

            const caption = document.createElement("p");
            caption.textContent = image.filename;

            imageItem.appendChild(imgElement);
            imageItem.appendChild(caption);
            galleryDiv.appendChild(imageItem);
        });
    } catch (error) {
        console.error(error);
        document.getElementById("gallery").textContent = "An error occurred while fetching images.";
    }
}
