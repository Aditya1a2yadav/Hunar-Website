  // Confirm before deletion
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const confirmed = confirm('Are you sure you want to delete this module? This action cannot be undone.');
      if (!confirmed) {
        event.preventDefault();
      }
    });
  });