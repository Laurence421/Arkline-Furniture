// Cloudflare Pages Function: GET /api/site-data
import { handleSiteData } from "../../api/site-data.js";

export const onRequestGet = ({ request, env }) => handleSiteData(request, env);
