per avviare correttamente il progetto bisogna creare un file in questa stessa cartella con nome ".env" con questa struttura:

DB_HOST=localhost 
DB_USER=root #utente del database
DB_PASSWORD=  #password di mysql
DB_DATABASE=flexifisio_db #nome del database
DB_PORT=3306 #porta su cui è in esecuzione mysql (3306 di default)
ACCESS_TOKEN_SECRETE=8a83b2f791c1a0f380775b6c5587dafe92c2f64874513e4b6d5fb57a8af0646a694750c764533ca1b7722ac96bc4f3580e6c4a2360488a5e4d7e43d456b699d5 
REFRESH_TOKEN_SECRETE=22db6aa3d2d2abfe66fa25e75ef3816a1d14041c1949aef1b21e131bc2538621d888b228f66981a4f703081b8a3cd74f71cfbe2de8f23ac7084033e803484316

#chiave con cui vengono codificati e decodificati gli access e i refresh token