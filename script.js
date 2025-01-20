document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('http://localhost:8000/api/members-db');
        const members = await response.json();

        const tableBody = document.getElementById('tableBody');
        members.forEach((member) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${member.vk_id}</td>
                <td>${member.first_name}</td>
                <td>${member.last_name}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
    }
});
