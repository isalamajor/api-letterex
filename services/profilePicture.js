const buildProfilePictureUrl = (userLike) => {
  if (!userLike) {
    return null;
  }
  const image = userLike.image;

  if (typeof image === "string" && /^https?:\/\//i.test(image)) {
    return image;
  }

  return null;
};

module.exports = {
  buildProfilePictureUrl,
};
