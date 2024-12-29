#!/bin/bash

# 创建 favicon 目录
mkdir -p public/favicon

# 从原始图片生成各种尺寸的 favicon
magick public/icon.png -resize 16x16 public/favicon/favicon-16x16.png
magick public/icon.png -resize 32x32 public/favicon/favicon-32x32.png
magick public/icon.png -resize 48x48 public/favicon/favicon-48x48.png
magick public/icon.png -resize 96x96 public/favicon/favicon-96x96.png
magick public/icon.png -resize 144x144 public/favicon/favicon-144x144.png
magick public/icon.png -resize 192x192 public/favicon/android-chrome-192x192.png
magick public/icon.png -resize 512x512 public/favicon/android-chrome-512x512.png
magick public/icon.png -resize 180x180 public/favicon/apple-touch-icon.png

# 生成 favicon.ico（包含多个尺寸）
magick public/icon.png -resize 16x16 public/favicon/favicon-16x16.ico
magick public/icon.png -resize 32x32 public/favicon/favicon-32x32.ico
magick public/favicon/favicon-16x16.ico public/favicon/favicon-32x32.ico public/favicon/favicon.ico
