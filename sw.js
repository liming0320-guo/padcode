"use strict";

const CACHE_NAME = "padcode-shell-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./vendor/codemirror/codemirror.min.css",
  "./vendor/codemirror/codemirror.min.js",
  "./vendor/codemirror/mode/xml/xml.min.js",
  "./vendor/codemirror/mode/javascript/javascript.min.js",
  "./vendor/codemirror/mode/css/css.min.js",
  "./vendor/codemirror/mode/python/python.min.js",
  "./vendor/codemirror/mode/clike/clike.min.js",
  "./vendor/codemirror/mode/htmlmixed/htmlmixed.min.js",
  "./vendor/codemirror/addon/edit/closebrackets.min.js",
  "./vendor/codemirror/addon/edit/matchbrackets.min.js",
  "./vendor/codemirror/addon/selection/active-line.min.js",
  "./vendor/monaco/vs/loader.js",
  "./vendor/monaco/vs/editor/editor.main.css",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE_NAME;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(function () {
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match("./index.html");
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then(function (response) {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      });
    })
  );
});
