## Dev notes

```
# from __dirname (not project root)
npm i some-module --save
npm shrinkwrap
```

* don't forget to run `npm install` if you test locally.
* also, `rm -rf node_modules` before running `docker build` from /services or the docker build context will be HUGE.
