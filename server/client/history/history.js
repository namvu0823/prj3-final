function validateDate() {
    const yearInput = document.getElementById("year").value;
    const monthInput = document.getElementById("month").value;
    const dayInput = document.getElementById("day").value;

    const currentDate = new Date();
    const year = yearInput ? parseInt(yearInput) : currentDate.getFullYear();
    const month = monthInput ? parseInt(monthInput) - 1 : currentDate.getMonth();
    const day = dayInput ? parseInt(dayInput) : currentDate.getDate();

    const inputDate = new Date(year, month, day);

    const isValid = inputDate.getFullYear() === year && inputDate.getMonth() === month && inputDate.getDate() === day;

    let result = "";

    if (!isValid) {
        result = `The entered date is not valid. Please enter a correct date.`;
    } else {
        result = `The date ${inputDate.toDateString()} is valid.`;
    }

    document.getElementById("result").textContent = result;
}
