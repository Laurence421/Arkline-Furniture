// Cloudflare Pages Function: POST /api/quote
import { handleQuote } from "../../api/quote.js";

export const onRequestPost = ({ request, env }) => handleQuote(request, env);
