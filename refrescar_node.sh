pkill -f "node.*server.js" 2>/dev/null; sleep 1; npm start


#lsof -ti:8001 | xargs kill -9 2>/dev/null; sleep 1; npm run dev &