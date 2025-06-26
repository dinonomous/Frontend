import axios from 'axios';

const instance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
});

// Only add the token in the browser
if (typeof window !== 'undefined') {
    instance.interceptors.request.use((config) => {
        const token = localStorage.getItem('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });
}

export default instance;
