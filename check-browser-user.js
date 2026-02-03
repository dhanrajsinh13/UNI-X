// Run this in the browser console to check your login status
console.log('=== USER INFO ===');
const user = JSON.parse(localStorage.getItem('user') || '{}');
const token = localStorage.getItem('token');
console.log('User:', user);
console.log('User ID:', user.id);
console.log('User Name:', user.name);
console.log('Token exists:', !!token);
console.log('Token (first 50 chars):', token?.substring(0, 50));
