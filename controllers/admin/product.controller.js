const Product = require("../../models/product.model");
const Account = require("../../models/accounts.model");

const productCategory = require("../../models/product-category.model");
const filterStatusHelper = require("../../helpers/filterStatus");
const searchHelper = require("../../helpers/search");
const paginationHelper = require("../../helpers/pagination");
const systemConfig = require("../../config/system");
const createTreeHelper = require("../../helpers/createTree");

// [GET] /admin/products
module.exports.index = async (req, res) => {
  // CONDITION of filter DATA
  let find = {
    deleted: false,
  };

  // FILTER STATUS
  const filterStatus = filterStatusHelper(req);

  if (req.query.status) {
    // filter DATA follow params
    find.status = req.query.status;
  }

  // SEARCH BY KEYWORD
  const objSearch = searchHelper(req);

  let keyword = "";
  if (req.query.keyword) {
    keyword = objSearch.keyword;

    find.title = objSearch.regex;
  }

  // PAGINATION
  const countProduct = await Product.countDocuments(find);

  let objectPagination = paginationHelper(
    {
      currentPage: 1,
      limitItem: 6,
    },
    req,
    countProduct
  );

  // SORT
  let sort = {};

  if (req.query.sortKey && req.query.sortValue) {
    sort[req.query.sortKey] = req.query.sortValue;
  } else {
    sort.position = "desc";
  }
  // END SORT

  // GIVE product by FIND
  // .limit(number) => chỉ lấy tưng đấy sản phẩm thôi
  // skip: bỏ qua bao nhiêu sản phẩm
  const products = await Product.find(find)
    .sort(sort)
    .limit(objectPagination.limitItem)
    .skip(objectPagination.skip);

  // Information of creater
  for (const product of products) {
    // Lấy ra thông tin người tạo
    const user = await Account.findOne({
      _id: product.createdBy.account_id,
    });

    if (user) {
      product.userFullName = user.fullName;
    } else {
      product.userFullName = "";
    }

    // lấy ra thông tin người cập nhật gần nhất
    const updatedBy = product.updatedBy[product.updatedBy.length - 1];
    if (updatedBy) {
      const userUpdate = await Account.findOne({
        _id: updatedBy.account_id,
      });

      if (userUpdate) {
        updatedBy.accountFullName = userUpdate.fullName;
      }
    }
  }

  res.render("admin/pages/products/index.pug", {
    pageTitle: "Trang quản lí sản phẩm",
    products: products,
    filterStatus: filterStatus,
    keyword: keyword,
    pagination: objectPagination,
  });
};

// [PATCH] /admin/change-status/:status/:id
module.exports.changeStatus = async (req, res) => {
  const status = req.params.status;
  const id = req.params.id;

  const updatedBy = {
    account_id: res.locals.user.id,
    updatedAt: new Date(),
  };

  await Product.updateOne(
    { _id: id },
    {
      status: status,
      $push: { updatedBy: updatedBy },
    }
  );

  req.flash("success", "Cập nhật trạng thái thành công");

  res.redirect("back");
};

// [PATCH] /admin/change-multi
module.exports.changeMulti = async (req, res) => {
  const type = req.body.type;
  const ids = req.body.ids.split(", ");

  const updatedBy = {
    account_id: res.locals.user.id,
    updatedAt: new Date(),
  };

  // UPDATE nhiều sản phẩm
  switch (type) {
    case "active":
      await Product.updateMany(
        { _id: { $in: ids } },
        {
          status: type,
          $push: { updatedBy: updatedBy },
        }
      );
      break;
    case "inactive":
      await Product.updateMany(
        { _id: { $in: ids } },
        {
          status: type,
          $push: { updatedBy: updatedBy },
        }
      );
      break;
    case "delete-all":
      await Product.updateMany(
        { _id: { $in: ids } },
        {
          deleted: true,
          deleteAt: new Date(),
          $push: { updatedBy: updatedBy },
        }
      );
      break;
    case "change-position":
      for (const item of ids) {
        // cấu trúc destructering phá vỡ cấu trúc
        let [id, position] = item.split("-");
        // parse từ String => int
        position = parseInt(position);
        // update
        await Product.updateOne(
          { _id: id },
          {
            position: position,
            $push: { updatedBy: updatedBy },
          }
        );
      }
      break;
    default:
      break;
  }

  req.flash("success", "Cập nhật trạng thái thành công");

  // res.send("oke")
  res.redirect("back");
};

// [DELETE] /admin/products/delete/:id
module.exports.deleteItem = async (req, res) => {
  const id = req.params.id;

  await Product.updateOne(
    { _id: id },
    {
      deleted: true,
      deletedBy: {
        account_id: res.locals.user._id,
        deletedAt: new Date(),
      },
    }
  );
  // res.send("oke")
  res.redirect("back");
};

// [GET] /admin/products/create
module.exports.create = async (req, res) => {
  const records = await productCategory.find({ deleted: false });

  const newRecords = createTreeHelper.createTree(records);

  res.render("admin/pages/products/create", {
    pageTitle: "Trang thêm mới sản phẩm",
    category: newRecords,
  });
};

// [POST] /admin/products/createPost
module.exports.createPost = async (req, res) => {
  req.body.price = parseInt(req.body.price);
  req.body.stock = parseInt(req.body.stock);
  req.body.discountPercentage = parseInt(req.body.discountPercentage);

  // case: POSITION : AUTO INCREASE
  if (req.body.position == "") {
    const countProduct = await Product.countDocuments();
    req.body.position = countProduct + 1;
  } else {
    req.body.position = parseInt(req.body.position);
  }

  req.body.createdBy = {
    account_id: res.locals.user._id,
  };

  // create new Product
  const product = new Product(req.body);

  // saving in DATABASE
  await product.save();
  // render viewer
  res.redirect(`${systemConfig.prefixAdmin}/products`);
};

// [GET] /admin/products/edit/:id
module.exports.edit = async (req, res) => {
  const find = {
    deleted: false,
    _id: req.params.id,
  };
  try {
    const product = await Product.findOne(find);

    const records = await productCategory.find({ deleted: false });

    const newRecords = createTreeHelper.createTree(records);

    res.render("admin/pages/products/edit", {
      pageTitle: "Trang chỉnh sửa sản phẩm",
      product: product,
      category: newRecords,
    });
  } catch (error) {
    res.redirect(`${systemConfig.prefixAdmin}/products`);
  }
};

// [PATCH] /admin/products/edit/:id
module.exports.editPatch = async (req, res) => {
  const id = req.params.id;
  req.body.price = parseInt(req.body.price);
  req.body.stock = parseInt(req.body.stock);
  req.body.discountPercentage = parseInt(req.body.discountPercentage);
  req.body.position = parseInt(req.body.position);

  if (req.file) {
    req.body.thumbnail = `/uploads/${req.file.filename}`;
  }

  try {
    const updatedBy = {
      account_id: res.locals.user.id,
      updatedAt: new Date(),
    };

    await Product.updateOne(
      { _id: id },
      {
        ...req.body, // cú pháp destructering, rải những phần tử ra
        $push: { updatedBy: updatedBy }, // cú pháp push vào Array
      }
    );

    req.flash("success", "Update thành công");
  } catch (error) {
    req.flash("error", "Update lỗi");
  }

  res.redirect("back");
};

// [GET] /admin/products/detail/:id
module.exports.detail = async (req, res) => {
  const find = {
    deleted: false,
    _id: req.params.id,
  };

  try {
    const product = await Product.findOne(find);

    res.render("admin/pages/products/detail", {
      pageTitle: product.title,
      product: product,
    });
  } catch (error) {
    res.redirect(`${systemConfig.prefixAdmin}/products`);
  }
};

// [GET] /admin/bin
module.exports.bin = async (req, res) => {
  // CONDITION of filter DATA
  let find = {
    deleted: true,
  };

  // FILTER STATUS
  const filterStatus = filterStatusHelper(req);

  // PAGINATION
  const countProduct = await Product.countDocuments(find);

  let objectPagination = paginationHelper(
    {
      currentPage: 1,
      limitItem: 6,
    },
    req,
    countProduct
  );

  // GIVE product by FIND
  const products = await Product.find(find)
    .sort({ price: "desc" })
    .limit(objectPagination.limitItem)
    .skip(objectPagination.skip);

  res.render("admin/pages/products/bin.pug", {
    pageTitle: "Trang quản lí sản phẩm đã xóa",
    products: products,
    filterStatus: filterStatus,
    pagination: objectPagination,
  });
};

// [PATCH] /admin/restore/:id
module.exports.restore = async (req, res) => {
  const id = req.params.id;

  await Product.updateOne({ _id: id }, { deleted: false });

  req.flash("success", "Cập nhật trạng thái thành công");

  res.redirect("back");
};

// [DELETE] /admin/products/deleteHard/:id
module.exports.deleteHard = async (req, res) => {
  const id = req.params.id;

  await Product.deleteOne({ _id: id });

  req.flash("success", "Bạn đã xóa thành công");

  // res.send("oke")
  res.redirect("back");
};

// [PATCH] /admin/products/changeMultiBin
module.exports.changeMultiBin = async (req, res) => {
  const type = req.body.type;
  const ids = req.body.ids;

  const idsArr = ids.split(", ");

  switch (type) {
    case "delete-all":
      await Product.deleteMany({ _id: { $in: idsArr } });

      req.flash("success", "Bạn xóa thành công");
      break;
    case "restore":
      await Product.updateMany({ _id: { $in: idsArr } }, { deleted: false });

      req.flash("success", "Bạn khôi phục thành công");
      break;
    default:
      req.flash("error", "Bạn thực hiện hành động thất bại");
      break;
  }

  // res.send("oke")
  res.redirect("back");
};
