const mongoose = require('mongoose');
require('dotenv').config();
const Donation = require('../models/Donation');
const User = require('../models/User');

const LIGHTWEIGHT_PLACEHOLDER = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMzAwIDMwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiMwZjE3MmEiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIyODAiIGhlaWdodD0iMjgwIiByeD0iMTUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzEwYjk4MSIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtZGFzaGFycmF5PSIxMCA1Ii8+PHBhdGggZD0iTTE1MCA5MCBDMTMwIDYwLCA5MCA2MCwgOTAgMTAwIEM5MCAxNDAsIDE1MCAyMDAsIDE1MCAyMTAgQzE1MCAyMDAsIDIxMCAxNDAsIDIxMCAxMDAgQzIxMCA2MCwgMTcwIDYwLCAxNTAgOTAgWiIgZmlsbD0iIzEwYjk4MSIgb3BhY2l0eT0iMC44Ii8+PHRleHQgeD0iNTAlIiB5PSI4MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI2YxZjVmOSI+U3BhcmVTaGFyZSBBSTwvdGV4dD48dGV4dCB4PSI1MCUiIHk9Ijg3JSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5NGEzYjgiPlZlcmlmaWVkIERvbmF0aW9uIEl0ZW08L3RleHQ+PC9zdmc+`;
const USER_PIC_PLACEHOLDER = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNTAiIGZpbGw9IiMxMGI5ODEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDAiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSI+VTwvdGV4dD48L3N2Zz4=`;
const USER_BANNER_PLACEHOLDER = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgODAwIDIwMCI+PHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMxZTI5M2IiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzAiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMTBiOTgxIj5TcGFyZVNoYXJlIFBhcnRuZXI8L3RleHQ+PC9zdmc+`;

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    // Update donations with raw svg text
    const donRes = await Donation.updateMany(
      { imageUrl: /^data:image\/svg\+xml;utf8/ },
      { $set: { imageUrl: LIGHTWEIGHT_PLACEHOLDER } }
    );
    console.log(`Donations updated: ${donRes.modifiedCount}`);

    // Update user profile pictures
    const userPicRes = await User.updateMany(
      { profilePic: /^data:image\/svg\+xml;utf8/ },
      { $set: { profilePic: USER_PIC_PLACEHOLDER } }
    );
    console.log(`User profile pics updated: ${userPicRes.modifiedCount}`);

    // Update user banners
    const userBannerRes = await User.updateMany(
      { profileBanner: /^data:image\/svg\+xml;utf8/ },
      { $set: { profileBanner: USER_BANNER_PLACEHOLDER } }
    );
    console.log(`User banners updated: ${userBannerRes.modifiedCount}`);

  } catch (err) {
    console.error("Migration Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
