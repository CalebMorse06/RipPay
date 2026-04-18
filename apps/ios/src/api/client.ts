import axios from 'axios';
import {API_BASE_URL} from '../constants';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {'Content-Type': 'application/json'},
});

export default client;
