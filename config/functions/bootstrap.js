"use strict";

/**
 * An asynchronous bootstrap function that runs before
 * your application gets started.
 *
 * This gives you an opportunity to set up your data model,
 * run jobs, or perform some special logic.
 *
 * See more details here: https://strapi.io/documentation/developer-docs/latest/setup-deployment-guides/configurations.html#bootstrap
 */

module.exports = () => {
  const checkUserExistsInRoom = async (username, room) => {
    const userExists = await strapi.services.chatters.find({ username, room });
    return userExists;
  };

  const createUser = async (username, room, status, socketId) => {
    const user = await strapi.services.chatters.create({
      username,
      room,
      status: status,
      socketId,
    });
    return user;
  };

  const checkUserExists = async (id) => {
    const user = await strapi.services.chatters.findOne({ _id: id });
    return user;
  };

  const getUsersInRoom = async (room) => {
    const usersInRoom = await strapi.services.chatters.find({ room });
    return usersInRoom;
  };

  const deleteUserFromRoom = async (socketId) => {
    const user = await strapi.services.chatters.delete({ socketId });
    return user;
  };

  var io = require("socket.io")(strapi.server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      allowedHeaders: ["my-custom-header"],
      credentials: true,
    },
  });
  io.on("connection", function (socket) {
    socket.on("join", async ({ username, room }, callback) => {
      try {
        const userExists = await checkUserExistsInRoom(username, room);

        if (userExists.length > 0) {
          callback(
            `User ${username} already exists in room no${room}. Please select a different name or room`
          );
        } else {
          const user = await createUser(username, room, "ONLINE", socket.id);

          if (user) {
            socket.join(user.room);
            socket.emit("welcome", {
              user: "bot",
              text: `${user.username}, Welcome to room ${user.room}.`,
              userData: user,
            });
            socket.broadcast.to(user.room).emit("message", {
              user: "bot",
              text: `${user.username} has joined`,
            });
            io.to(user.room).emit("roomInfo", {
              room: user.room,
              users: await getUsersInRoom(user.room),
            });
          } else {
            callback(`user could not be created. Try again!`);
          }
        }
        callback();
      } catch (err) {
        console.log("Err occured, Try again!", err);
      }
    });

    socket.on("sendMessage", async (data, callback) => {
      try {
        const user = await checkUserExists(data.userId);
        if (user) {
          io.to(user.room).emit("message", {
            user: user.username,
            text: data.message,
          });
        } else {
          callback(`User doesn't exist in the database. Rejoin the chat`);
        }
        callback();
      } catch (err) {
        console.log("err inside catch block", err);
      }
    });

    socket.on("disconnect", async (data) => {
      try {
        const user = await deleteUserFromRoom(socket.id);
        console.log("deleted user is", user);
        if (user.length > 0) {
          io.to(user[0].room).emit("message", {
            user: user[0].username,
            text: `User ${user[0].username} has left the chat.`,
          });
          io.to(user.room).emit("roomInfo", {
            room: user.room,
            users: await getUsersInRoom(user[0].room),
          });
        }
      } catch (err) {
        console.log("error while disconnecting", err);
      }
    });
  });
};
