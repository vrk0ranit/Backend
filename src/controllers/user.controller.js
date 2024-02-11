import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User} from "../models/user.model.js"
import {uploadOnCloudinary}  from "../utils/cloudnery.js";
import {ApiResponse} from "../utils/ApiResponse.js";

const registerUser = asyncHandler ( async (req, res) => {
     //get user detail from frontend
     // Validtaion - not empty
     //check if user already exist: usename ,email
     //check for images,check for avtar
     //upload on clodinary
     //create user object - create entry in db
     //remove password and refresh token field from response
     //check for user crreation
     //return response

     const {fullname, email, username, password } = req.body
     console.log("email: ", email);

     if (
        [fullname, email, username, password].some((field)  => field?.trim() === "")
     ) {
         throw new ApiError  (400, "All fields are required")
     }

     const existedUser = User.findOne({
        $or: [{ username }, { email }]
     })

     if (existedUser) {
        throw new ApiError(409, "User with email and username already exist")
     }

    const avtarLocalPath = req.files?.avatar[0]?.path;

    const coverImageLocalPath = req.files?.coverImagge[0]?.path;
    if(!avtarLocalPath) {
        throw new ApiError(400, "Avtar files is required")
    }
     const avtar = await uploadOnCloudinary(avtarLocalPath)
     const coverImage = await uploadOnCloudinary(coverImageLocalPath)

     if(!avtar) {
        throw new ApiError(400, " Avtar file is required")
     }
     const user = await User.create({
        fullname,
        avtar:avtar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
     })
     const createdUser = await User.findById(user._id).select(
        "-password  -refreshToken"
     )

     if(!createdUser) {
        throw new ApiError(500 , "Something went wrong while registering the user")
     }

     return res.status(201).json(
        new ApiResponse(200, createdUser, "User Register successfully")
     )


    })



export {registerUser,}