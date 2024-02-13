import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User} from "../models/user.model.js"
import {uploadOnCloudinary}  from "../utils/cloudinery.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"


const generateAccessAndRefereshTokens = async(userId) => {
   try{
      const user = await User.findById(userId)  
      const accessToken = user.generateAccessToken()
      const refereshToken = user.generateRefreshToken() 
      user.refereshToken = refereshToken
      await user.save({validateBeforeSave: false})
      return {accessToken, refereshToken}


   } catch(error){
      throw new ApiError(500, "Something went wrong while generating referesh and access token")
   }
}

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

     const {fullName, email, username, password } = req.body
   //   console.log("email: ", email);

     if (
        [fullName, email, username, password].some((field)  => field?.trim() === "")
     ) {
         throw new ApiError  (400, "All fields are required")
     }

     const existedUser = await User.findOne({
        $or: [{ username }, { email }]
     })

     if (existedUser) {
        throw new ApiError(409, "User with email and username already exist")
     }

   //  const avtarLocalPath = req.files?.avatar[0]?.path;
   const avatarLocalPath = req.files?.avatar[0]?.path;

   //  const coverImageLocalPath = req.files?.coverImage[0]?.path;
   let coverImageLocalPath
   if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
      coverImageLocalPath = req.files.coverImage[0].path

   } 


    if(!avatarLocalPath) {
        throw new ApiError(400, "Avtar files is required")
    }
     const avatar = await uploadOnCloudinary(avatarLocalPath)
     const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
     if(!avatar) {
        throw new ApiError(400, " Avatar file is required")
     }
     const user = await User.create({
        fullName,
        avatar:avatar.url,
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

    const loginUser = asyncHandler(async (req, res) => {
      //req body -> data
      //username or email
      //find the user
      //password check
      //access and referesh token
      //send cookie

      const {email, username, password} =req.body

      if(!username && !email) {
         throw new ApiError(400, "username or email is required")
      }

      const user = await User.findOne({
         $or: [{username}, {email}]
      })
      if(!user){
         throw new ApiError(404, "User does not exist")
      }
      const isPasswordValid = await user.isPasswordCorrect(password)
      if(!isPasswordValid){
         throw new ApiError(401, "Invalid user credentials")
      }
      const {accessToken,refereshToken} = await generateAccessAndRefereshTokens(user._id)

     const loggedInUser = await User.findById(user._id).
     select("-password -refreshToken")

     const options = {
      httpOnly: true,
      secure: true
     }
     return res
     .status(200)
     .cookie("accessToken", accessToken, options)
     .cookie("refereshToken", refereshToken, options)
     .json(
      new ApiResponse(
         200,
         {
            user: loggedInUser,accessToken, refereshToken
         },
         "User logged  In successfully"
      )
     )

    })

    const logoutUser = asyncHandler(async(req, res) => {
      await User.findByIdAndUpdate(
         req.user._id,
         {
            $unset: {
              refreshToken: 1 //This removes the field from document
            }
         },
         {
            new: true
         }
      )

      const options = {
         httpOnly: true,
         secure: true
        }

        return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refereshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully"))
      
    })


    const refereshAccessToken =asyncHandler(async(req,res) => {
      const incomingRefreshToken = req.cookies.refereshToken || req.body.refereshToken

      if(incomingRefreshToken) {
         throw new ApiError(401, "unauthorized request")
      }

      try {
         const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
         )
   
         const user = await User.findById(decodedToken?._id)
         if(!user){
            throw new ApiError(401, "Invalid refresh token")
         }
   
         if(!incomingRefreshToken !== user?. refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
         }
           
         const options = {
            httpOnly: true,
            secure: true
         }
         const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
   
         return res
         .status(200)
         .cookie("accessToken", accessToken, options)
         .cookie("refreshToken", newRefreshToken, options) 
         .json(
            new ApiResponse(
               200,
               {accessToken, refreshToken: newRefreshToken},
               "Access token refreshed"
   
            )
   
         )
   
      } catch (error) {
         throw new ApiError(401, error?.message || "Invalid refresh token")
      }
    })



export {
   registerUser,
   loginUser,
   logoutUser,
   refereshAccessToken
}