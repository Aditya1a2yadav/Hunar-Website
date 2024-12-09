// Check for duplicate module name
document.getElementById('module-form').addEventListener('submit', async (event) => {
    const moduleName = document.getElementById('module_name').value;
  
    const response = await fetch(`/mod/check_name?name=${encodeURIComponent(moduleName)}`);
    const data = await response.json();
  
    if (data.exists) {
      event.preventDefault();
      alert('Module already exists. Please choose a different name.');
    }
  });
  

  