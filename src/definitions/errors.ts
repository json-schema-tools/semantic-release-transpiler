
export default {
  ENODOCUMENT: () => ({
    code: "ENODOCUMENT",
    message: "Missing json schema document file.",
    details: [
      "you must have a json schema to run this plugin"
    ].join("\n\n"),
  }),
};
