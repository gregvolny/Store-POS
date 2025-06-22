const CACHE_NAME = 'pos-cache-v1';
const urlsToCache = [
  '../index.html',
  '../assets/css/bootstrap.min.css',
  '../assets/css/core.css',
  '../assets/css/components.css',
  '../assets/css/icons.css',
  '../assets/css/pages.css',
  '../assets/css/responsive.css',
  '../assets/plugins/chosen/chosen.min.css',
  '../assets/plugins/daterangepicker/daterangepicker.css',
  '../assets/plugins/dataTables/jquery.dataTables.min.css',
  '../assets/plugins/dataTables/dataTables.bootstrap.min.css',
  '../assets/images/default.jpg',
  '../assets/images/loading.gif',
  '../assets/images/icon.ico',
  '../renderer.js',
  '../assets/js/pos.js',
  '../assets/js/product-filter.js',
  '../assets/plugins/jquery/jquery.min.js', // Assuming jquery is needed, will confirm path
  '../assets/plugins/bootstrap/bootstrap.min.js',
  '../assets/plugins/chosen/chosen.jquery.min.js',
  '../assets/plugins/jquery-ui/jquery.form.min.js',
  '../assets/plugins/daterangepicker/daterangepicker.min.js',
  '../assets/plugins/dataTables/jquery.dataTables.min.js',
  '../assets/plugins/dataTables/jquery.dataTables.bootstrap.js',
  '../assets/plugins/dataTables/dataTables.buttons.min.js',
  '../assets/plugins/dataTables/buttons.html5.min.js',
  '../assets/plugins/dataTables/pdfmake.min.js',
  '../assets/plugins/dataTables/vfs_fonts.js',
  '../assets/fonts/fontawesome-webfont5b62.woff2?v=4.7.0', // Added common font files, will need to verify exact files used
  '../assets/fonts/glyphicons-halflings-regular.woff2',
  // Add other essential assets like important images, fonts used in the UI
  // It's important to list all files that are critical for the app shell to load
  // For a complete list, a more thorough check of network requests or build output would be needed.
];

// Install a service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // It's possible some of these paths might be incorrect or files might be missing.
        // For a real deployment, ensure all paths are correct and files exist.
        // Using addAll which will fail if any resource is not found.
        return cache.addAll(urlsToCache.map(url => new Request(url, { cache: 'reload' })))
          .catch(error => {
            console.error('Failed to cache one or more resources during install:', error);
            // Optionally, you could try to cache them individually and log errors
            // for url in urlsToCache:
            //   cache.add(url).catch(err => console.warn(`Failed to cache ${url}: ${err}`));
          });
      })
  );
});

// Cache and return requests
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          response => {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});

// Update a service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
