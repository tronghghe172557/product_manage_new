// Mã hóa MD5
const md5 = require("md5");
// SCHEMA
const Account = require("../../models/accounts.model");
const Role = require("../../models/roles.model");

const systemConfig = require("../../config/system");

// [GET] /admin/accounts
module.exports.index = async (req, res) => {
  try {
    const find = {
      deleted: false,
    };

    const records = await Account.find(find).select("-password -token");

    for (const record of records) {
        const role = await Role.findOne({
            _id: record.role_id,
            deleted: false,
        });
        record.role = role;
    }

    res.render("admin/pages/accounts/index.pug", {
      pageTitle: "Danh sách tài khoản",
      records: records,
    });
  } catch (error) {
    console.log("Err in account.controller.js");
  }
};

// [GET] /admin/accounts/create
module.exports.create = async (req, res) => {
  try {
    const find = {
      deleted: false,
    };

    const roles = await Role.find(find);

    res.render("admin/pages/accounts/create.pug", {
      pageTitle: "Danh sách tài khoản",
      roles: roles,
    });
  } catch (error) {
    console.log("Err in role.controller.js");
  }
};

// [POST] /admin/accounts/createPost
module.exports.createPost = async (req, res) => {
  try {
    // CHECK EMAIL EXIST
    const emailExist = await Account.findOne({
      email: req.body.email,
      deleted: false
    });

    if (emailExist) {
      req.flash("error", `Email ${req.body.email} đã tồn tại`);

      res.redirect(`back`);
    } else {
      req.body.password = md5(req.body.password);

      const record = new Account(req.body);

      await record.save();

      req.flash("success", "Tạo tài khoản thành công");

      res.redirect(`${systemConfig.prefixAdmin}/accounts`);
    }
  } catch (error) {
    console.log("Err in role.controller.js");
    req.flash("error", "Tạo tài khoản thất bại");
  }
};
