// A sign-in link (Google, password reset) that lands on the home page instead of the admin page
// (Supabase falls back to its Site URL) goes straight on to the admin page, before the home page draws.
(function(){
  if(/(^|&)(access_token|refresh_token|error_description|type=recovery)/.test(location.hash.slice(1))||/[?&]code=/.test(location.search))
    location.replace((location.hostname==="localhost"?"/admin.html":"/admin")+location.search+location.hash);
})();
