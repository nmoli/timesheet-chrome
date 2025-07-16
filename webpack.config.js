const path = require("path");
const webpack = require("webpack");
const dotenv = require("dotenv");
const env = dotenv.config().parsed || {};

module.exports = {
  entry: "./src/popup.js",
  output: {
    filename: "popup.js",
    path: path.resolve(__dirname, "./"),
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx"],
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.REACT_APP_TIMESHEET_AUTH_TOKEN": JSON.stringify(
        env.REACT_APP_TIMESHEET_AUTH_TOKEN
      ),
      "process.env.API_URL": JSON.stringify(env.API_URL),
    }),
  ],
};
