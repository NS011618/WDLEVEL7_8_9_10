const app = require("./app");
//the webpage will open at server 3000 or else other portnumber or website
app.listen(process.env.PORT || 3000, () => {
  console.log("Started express server at port 3000");
});
