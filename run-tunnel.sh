#!/bin/bash
while true; do
  echo "Menyambungkan ke Serveo..."
  ssh -o "ServerAliveInterval 60" -o "ServerAliveCountMax 3" -R rullzyepremiumstore:80:localhost:3000 serveo.net
  echo "Koneksi terputus, mencoba lagi dalam 5 detik..."
  sleep 5
done
