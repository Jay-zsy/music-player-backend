/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */
require("dotenv").config();
const express = require("express"); // Express web server framework
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
const PORT = process.env.PORT || 8888; // When you build, heroku has their own port
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const cheerio = require("cheerio");

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID; // Your spotify client id
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET; // Your spotify secret
const SPOTIFY_CALLBACK_URI = process.env.SPOTIFY_CALLBACK_URI; // Your spotify redirect uri
const GENIUS_CLIENT_ID = process.env.GENIUS_CLIENT_ID; // Your genius client id
const GENIUS_CLIENT_SECRET = process.env.GENIUS_CLIENT_SECRET; // Your genius secret
const GENIUS_CALLBACK_URI = process.env.GENIUS_CALLBACK_URI; // Your genius redirect uri
const FRONTEND_CALLBACK_URL = process.env.FRONTEND_CALLBACK_URL; // Your frontend uri
const SCOPE = process.env.SCOPE;
/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
let generateRandomString = function (length) {
  let text = "";
  let possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

let stateKey = "spotify_auth_state";

let app = express();

app.use(express.json());

app
  .use(express.static(__dirname + "/build"))
  .use(cors({ credentials: true, origin: "*" }))
  .use(cookieParser())
  .use(morgan("dev"));

app.get("/spotify", function (req, res) {
  let state = generateRandomString(16);
  res.cookie(stateKey, state);
  // your application requests authorization
  let scope = SCOPE;
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: SPOTIFY_CLIENT_ID,
        scope,
        redirect_uri: SPOTIFY_CALLBACK_URI,
        state,
      })
  );
});

app.get("/spotifycallback", function (req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter
  let code = req.query.code || null;
  let state = req.query.state || null;
  let storedState = req.cookies ? req.cookies[stateKey] : null;
  if (state === null || state !== storedState) {
    res.redirect(
      "/#" +
        querystring.stringify({
          error: "state_mismatch",
        })
    );
  } else {
    res.clearCookie(stateKey);
    const params = {
      redirect_uri: SPOTIFY_CALLBACK_URI,
      code,
      grant_type: "authorization_code",
    };
    axios({
      method: "post",
      url: "https://accounts.spotify.com/api/token",
      params,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          new Buffer.from(
            SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET
          ).toString("base64"),
      },
    })
      .then((response) => {
        const access_token = response.data.access_token;
        const refresh_token = response.data.refresh_token;
        res.cookie("spotify_access_token", access_token);
        console.log(response);
        // res.cookie("refresh_token", refresh_token); we prob want to send this to the database instead
        axios({
          method: "get",
          url: "https://api.spotify.com/v1/me",
          headers: { Authorization: "Bearer " + access_token },
        })
          .then(() => {
            res.redirect(FRONTEND_CALLBACK_URL);
          })
          .catch((e) => {
            res.redirect(
              "/#" + querystring.stringify({ error: e.response.data })
            );
          });
      })
      .catch((e) => console.error(e.response.data));
  }
});

//     axios.post(authOptions, function (error, response, body) {
//       if (!error && response.statusCode === 200) {
//         console.log(body);
//         let access_token = body.access_token,
//           refresh_token = body.refresh_token;
//         console.log("Got the access token!");
//         res.cookie("access_token", access_token);
//         res.cookie("refresh_token", refresh_token);
//         let options = {
//           url: "https://api.spotify.com/v1/me",
//           headers: { Authorization: "Bearer " + access_token },
//           json: true,
//         };

//         // use the access token to access the Spotify Web API
//         axios.get(options, function (error, response, body) {
//           console.log(body);
//         });

//         // we can also pass the token to the browser to make requests from there
//         res.redirect(FRONTEND_CALLBACK_URL);
//       } else {
//         res.redirect(
//           FRONTEND_CALLBACK_URL +
//             "?error=" +
//             querystring.stringify({
//               error: "invalid_token",
//             })
//         );
//       }
//     });
//   }

app.get("/refresh_token", function (req, res) {
  console.log("afterwards");
  // requesting access token from refresh token
  let refresh_token = req.cookies.refresh_token;
  console.log(refresh_token);
  let authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization:
        "Basic " +
        new Buffer(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString(
          "base64"
        ),
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    },
    json: true,
  };

  axios.post(authOptions, function (error, response, body) {
    console.log(error, response, body);
    if (!error && response.statusCode === 200) {
      let access_token = body.access_token;
      res.cookie("access_token", access_token);
      res.status(204).send();
    }
  });
});

// app.get("/genius", function (req, res) {
//   // your application requests authorization
//   let state = generateRandomString(16);
//   let scope = "me create_annotation manage_annotation vote";
//   res.redirect(
//     "https://api.genius.com/oauth/authorize?" +
//       querystring.stringify({
//         response_type: "code",
//         client_id: GENIUS_CLIENT_ID,
//         scope,
//         redirect_uri: GENIUS_CALLBACK_URI,
//         state,
//       })
//   );
// });
// app.get("/geniuscallback", function (req, res) {
//   // your application requests refresh and access tokens
//   // after checking the state parameter
//   let code = req.query.code || null;
//   let state = req.query.state || null;
//   if (state === null) {
//     res.redirect(
//       "/#" +
//         querystring.stringify({
//           error: "state_mismatch",
//         })
//     );
//   } else {
//     res.clearCookie(stateKey);
//     let authOptions = {
//       url: "https://api.genius.com/oauth/token",
//       form: {
//         code: code,
//         redirect_uri: GENIUS_CALLBACK_URI,
//         grant_type: "authorization_code",
//       },
//       headers: {
//         Authorization:
//           "Basic " +
//           new Buffer.from(
//             GENIUS_CLIENT_ID + ":" + GENIUS_CLIENT_SECRET
//           ).toString("base64"),
//       },
//       json: true,
//     };
//     console.log(authOptions);
//     axios
//       .post(authOptions, function (error, response, body) {
//         if (!error && response.statusCode === 200) {
//           console.log(body);
//           let access_token = body.access_token;
//           console.log("Got the access token!", access_token);
//           res.cookie("genius_access_token", access_token);
//           res.redirect(FRONTEND_CALLBACK_URL);
//         } else {
//           res.redirect(
//             FRONTEND_CALLBACK_URL +
//               "?error=" +
//               querystring.stringify({
//                 error: "invalid_token",
//               })
//           );
//         }
//       })
//       .catch((err) => console.log(err.config.data));
//   }
// });

// app.post("/lyrics", (req, res) => {
//   const token = req.body.token;
//   const trackName = req.body.trackName;
//   const trackArtist = req.body.trackArtist;
//   const firstCallOptions = {
//     method: "GET",
//     url: `https://api.genius.com/search?q=${encodeURI(trackName)}%20${encodeURI(
//       trackArtist
//     )}`,
//     headers: {
//       Authorization: "Bearer " + token,
//     },
//   };
//   const secondCallOptions = {
//     method: "GET",
//     url: `https://api.genius.com/search?q=${encodeURI(
//       trackName.split("(")[0].split("-")[0]
//     )}%20${encodeURI(trackArtist)}`,
//     headers: {
//       Authorization: "Bearer " + token,
//     },
//   };
//   axios.get(firstCallOptions, (error, response, body) => {
//     const firstDataArr = JSON.parse(body).response.hits;
//     //Check to see if there are any results
//     if (firstDataArr.length === 0) {
//       res.status(404).send("No lyrics available");
//       return;
//     }
//     //Second check for track name and artist match
//     if (
//       !firstDataArr[0].result.full_title
//         .toUpperCase()
//         .includes(trackName.toUpperCase()) &&
//       !firstDataArr[0].result.full_title
//         .toUpperCase()
//         .includes(trackArtist.toUpperCase())
//     ) {
//       //make another call without the parentheses
//       axios.get(secondCallOptions, (error, response, body) => {
//         const secondDataArr = JSON.parse(body).response.hits;
//         if (secondDataArr.length === 0) {
//           res.status(404).send("No lyrics available");
//           return;
//         }
//         if (
//           !secondDataArr[0].result.full_title
//             .toUpperCase()
//             .includes(trackName.split("(")[0].split("-")[0].toUpperCase()) &&
//           !secondDataArr[0].result.full_title
//             .toUpperCase()
//             .includes(trackArtist.toUpperCase())
//         ) {
//           res.status(404).send("No lyrics available");
//           return;
//         }
//         const URL = secondDataArr[0].result.url;
//         axios.get(URL, (error, response, body) => {
//           if (!error && res.statusCode === 200) {
//             const $ = cheerio.load(body);
//             const lyrics = $(".lyrics").text();
//             res.status(200).send(lyrics);
//             return;
//           } else {
//             res.status(418).send("No lyrics available");
//             return;
//           }
//         });
//       });
//     } else {
//       const URL = firstDataArr[0].result.url;
//       axios.get(URL, (error, response, body) => {
//         if (!error && res.statusCode === 200) {
//           const $ = cheerio.load(body);
//           const lyrics = $(".lyrics").text();
//           res.status(200).send(lyrics);
//           return;
//         } else {
//           res.status(418).send("No lyrics available");
//           return;
//         }
//       });
//     }
//   });
// });

console.log("Listening on 8888");
app.listen(PORT);
