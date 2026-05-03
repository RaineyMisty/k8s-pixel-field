# Webpage

## Docker

- Use `nginx` to load website

- Use port `80` as expose port

## How to run

```bash
# build docker image
docker build -t pixel-web:local .

# run container
docker run -d -p 5500:80 --name pixel-web-test pixel-web:local
```
