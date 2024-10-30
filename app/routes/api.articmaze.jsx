import { unauthenticated } from "../shopify.server";

export const action = async ({ request }) => {
  const data = await request.json();
  const method = request.method;

  if (method === "POST") {
    const shop = data.shop;
    if (shop && shop !== "") {
      const { session, admin } = await unauthenticated.admin(shop);

      setTimeout(async () => {
        oldVariantCheckAndDelete(admin, session, data);
      }, 100);

      const variantCreateResponse = await admin.graphql(
        `#graphql
          mutation {
            bulkVariantCreate: productVariantsBulkCreate(productId: "${data.productId}",
              variants: [
                {
                  optionValues: [
                    {
                      optionName: "${data.lengthOption}",
                      name: "${data.lengthValue}"
                    },
                    {
                      optionName: "${data.widthOption}",
                      name: "${data.widthValue}"
                    }
                  ],
                  price: ${data.price},
                  inventoryPolicy: CONTINUE
                }
              ]) {
                productVariants {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
        `,
      );

      const variantCreateResponseData = await variantCreateResponse.json();
      const variantCreateData =
        variantCreateResponseData?.data?.bulkVariantCreate;

      return {
        status: 200,
        data: variantCreateData?.productVariants,
        errors: variantCreateData?.userErrors,
      };
    }
  }

  return {
    status: 500,
    errors: [
      {
        field: "shop",
        message: "Server error",
      },
    ],
  };
};

const oldVariantCheckAndDelete = async (admin, session, data) => {
  try {
    const productId = data.productId.replace("gid://shopify/Product/", "");
    const productGid = data.productId;
    const filterDate = new Date().toISOString().split("T")[0]

    const getInsuranceProductsVariants = await admin.graphql(
      `#graphql
      query {
        productVariants(first: 100, query: "product_id:${productId} AND updated_at:<='${filterDate}'") {
          edges {
            node {
              id
              title
              createdAt
              product {
                title
              }
            }
          }
        }
      }
    `,
    );

    // get insurance products variants data
    const getVariantsResponseData = await getInsuranceProductsVariants.json();

    // check if any error in response
    if (getVariantsResponseData.errors) {
      const error = getVariantsResponseData.errors[0];
      return;
    }

    const variants = getVariantsResponseData.data.productVariants.edges || [];
    let oldVariantIds = [];

    oldVariantIds = variants?.map((variant) => variant.node.id);

    // remove first variant id from array
    oldVariantIds.shift();

    console.log("###### oldVariantIds", oldVariantIds);

    // variants bulk delete mutation
    const bulkVariantDeleteMutation = `#graphql
    mutation {
      productVariantsBulkDelete(productId: "${productGid}", variantsIds: [${oldVariantIds.map((variantId) => `"${variantId}"`).join(",")}]){ 
        product {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

    const bulkVariantDeleteResponse = await admin.graphql(
      bulkVariantDeleteMutation,
    );
    const bulkVariantDeleteResponseData =
      await bulkVariantDeleteResponse.json();

    if (bulkVariantDeleteResponseData.errors) {
      const error = bulkVariantDeleteResponseData.errors[0];
      console.log("old variant delete error ----------------", error);
      return;
    }

    console.log("###### Vriants which has been created a dat ago.");
  } catch (error) {
    console.error("error: ", error);
  }
};
