import User from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    } catch (error) {
        throw new Error("Failed to generate tokens: " + error.message);
    }
}


export const registerUser = async (req, res) => {
    try {
        const { username, fullName, email, password } = req.body;
        
        if([fullName, username, email, password].some((field) => field?.trim() === "")){
            return res.status(400).json({message: "All fields are required"})
        }

        const existedUser = await User.findOne({
            $or: [{ username }, { email }]
        })
        
        if(existedUser){
            return res.status(409).json({message: "User email or username already exists"});
        }

        const avatarLocalPath = req.files?.avatar[0]?.path

        let coverImageLocalPath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
            coverImageLocalPath = req.files.coverImage[0].path
        }

        if(!avatarLocalPath){
            return res.status(400).json({message: "Avatar is required"});
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath)
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)

        if(!avatar){
            return res.status(400).json({message: "Avatar is required"});
        }

        const user = await User.create({
            username: username.toLowerCase(),
            fullName,
            avatar: avatar.url,
            password,
            email,
            coverImage: coverImage?.url || "",

        })

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );
        if(!createdUser){
            return res.status(500).json({message: "Failed to register user"});
        }

        return res.status(201).json(
            {
                message: "User register Successfully",
                createdUser
            }
        )

    } catch (error) {
        return res.status(500).json({message: "error in registerUser",error: error.message});
    }
}


export const loginUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if(!username && !email){
            return res.status(400).json({messgae: "username or email is required"});
        }
        
        const user = await User.findOne({
            $or: [{ username }, { email }]
        })
        
        if(!user){
            return res.status(404).json({message: "User doesn't exists"});
        }
        
        const isPasswordValid = await user.isPasswordCorrect(password);
        
        if(!isPasswordValid){
            return res.status(401).json({message: "Password is invalid"});
        }
        
        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
        
        const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
        
        const options= {
            httpOnly: true,
            secure: true
        }

        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json({
            message: "user loggedIn successfully",
            user: loggedInUser,
            accessToken: accessToken,
            refreshToken: refreshToken,
        })

    } catch (error) {
        return res.status(500).json({message: "error in loginUser",error: error.message});
    }
}


export const logoutUser = async (req, res) => {
    try {
        
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    refreshToken: undefined
                } 
            },
            {
                new: true
            }
        )

        const options= {
            httpOnly: true,
            secure: true
        }

        return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json({
            message: "user loggedOut successfully",
        })
        
    } catch (error) {
        return res.status(500).json({ message: "error in logoutUser", error: error.message });
    }
}


export const refreshAccessToken = async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!incomingRefreshToken) {
    return res.status(401).json({ message: "Unauthorized request, refresh token missing" });
}

        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodedToken?._id)

        if(!user){
            return res.status(400).json("Unauthorise Request");
        }

        if(incomingRefreshToken !== user?.refreshToken){
            return res.status(400).json({message: "Invalid Refresh Token"});
        }

        const options= {
            httpOnly: true,
            secure: true
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json({
            message: "Access Token Refreshed Successfully",
            accessToken: accessToken,
            refreshToken: refreshToken,

        })

    } catch (error) {
        return res.status(500).json({message: "error in refreshAccessToken",error: error.message});
    }
}