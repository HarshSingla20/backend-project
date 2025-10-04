import mongoose from "mongoose";
import User from "../models/user.model.js"
import { uploadOnCloudinary, deleteOnCloudinary, getPublicIdFromURL } from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"
import { get } from "http";

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
                $unset:{
                    refreshToken: 1
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


export const changeCurrentPassword = async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        if(newPassword === oldPassword){
            return res.status(400).json({message: "New Password and Old Password cannot be same"});
        }
    
        if(newPassword !== confirmPassword){
            return res.status(400).json({message: "New Password and Confirm Password should be same"});
        }
    
        const user = await User.findById(req.user._id);
    
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
        
        if(!isPasswordCorrect){
            return res.status(400).json({message: "Wrong Password"});
        }
    
        user.password = newPassword;
        await user.save({validateBeforeSave: false});
    
        return res.status(200).json({message: "Password Changed Successfully"})
    
    } catch (error) {
        return res.status(500).json({ message: "Error in changeCurrentPassword", error: error.message });
    }
}


export const getCurrentUser = async (req, res) => {
    return res.status(200).json({
        status: 200,
        user: req.user,
        message: "Current user fetched successfully"
    });
};


export const updateAccountDetails = async(req, res) => {
    try {
        const {fullName, email} = req.body
    
        if (!fullName && !email) {
            return res.status(400).json({ message: "All fields are required" });
        }
    
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    fullName,
                    email: email
                }
            },
            {new: true}
            
        ).select("-password -refreshToken")
    
        return res
        .status(200)
        .json(
        {
            user: user, 
            message: "Account details updated successfully"
        })
    } catch (error) {
        return res.status(500).json({ message: "Error in updateAccountDetails", error: error.message });
    }

};


export const updateUserAvatar = async (req, res) => {
    try {
        const avatarLocalPath = req.file?.path;

        if(!avatarLocalPath){
            return res.status(400).json({message: "Avatar file is missing"});
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath);
        if(!avatar.url){
            return res.status(500).json({message: "Error while uploading avatar on cloudinary"});
        }
        const olduser = await User.findById(req.user._id);
        const avatarURL = olduser?.avatar;
        const avatarPublicId = getPublicIdFromURL(avatarURL);
        
        if(!avatarPublicId){
            console.log("No previous avatar found for this user, skipping deletion");
        }else{
            const isDeleted = await deleteOnCloudinary(avatarPublicId);
            
            if (isDeleted.result !== "ok") {
                console.warn("Failed to delete old avatar from Cloudinary");
            }
        }
        
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    avatar: avatar.url
                }
            },
            {
                new: true
            }
        ).select("-password -refreshToken");

        return res.status(200).json({
            message: "Avatar is changed successfully",
            user: user
        });

    } catch (error) {
        return res.status(500).json({ message: "Error in updateUserAvatar", error: error.message });
    }
}


export const updateUserCoverImage = async (req, res) => {
    try {
        const coverImageLocalPath = req.file?.path;

        if(!coverImageLocalPath){
            return res.status(400).json({message: "Cover Image file is missing"});
        }

        const coverImage = await uploadOnCloudinary(coverImageLocalPath);
        if(!coverImage.url){
            return res.status(500).json({message: "Error while uploading Cover Image on cloudinary"});
        }

        const olduser = await User.findById(req.user._id);
        const coverImageURL = olduser?.coverImage;
        const coverImagePublicId = getPublicIdFromURL(coverImageURL);

        if(!coverImagePublicId){
            console.log("No previous cover image found for this user, skipping deletion");
        }else{
            const isDeleted = await deleteOnCloudinary(coverImagePublicId);
    
            if (isDeleted.result !== "ok") {
                console.warn("Failed to delete old cover image from Cloudinary");
            }
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    coverImage: coverImage.url
                }
            },
            {
                new: true
            }
        ).select("-password -refreshToken");

        return res.status(200).json({
            message: "CoverImage is changed successfully",
            user: user
        });

    } catch (error) {
        return res.status(500).json({ message: "Error in updateUserCoverImage", error: error.message });
    }
}


export const getUserChannelProfile = async (req, res) => {
    try {
        const { username } = req.params;
    
        if(!username?.trim()){
            return res.status(400).json({message: "username is missing"})
        }
    
        const channel = await User.aggregate([
            {
                $match: {
                    username: username?.toLowerCase()
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            {
                $addFields: {
                    subscribersCount: {
                        $size: "$subscribers"
                    },
                    channelssubscribedToCount: {
                        $size: "$subscribedTo"
                    },
                    isSubscribed: {
                        $cond: {
                            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project: {
                    fullName: 1,
                    username: 1,
                    subscribersCount: 1,
                    channelssubscribedToCount: 1,
                    isSubscribed: 1,
                    avatar: 1,
                    coverImage: 1,
                    email: 1,
                }
            }
        ])
    
        if(!channel?.length){
            return res.status(404).json({message: "Channel doesn't exists"});
        }
    
        console.log(channel);
    
        return res.status(200).json({
            channel: channel[0],
            message: "user channel fetched Successfully"
        })
    } catch (error) {
        return res.status(400).json({message: "error in getUserChannelProfile", error: error.message});
    }
}


export const  getWatchHistory = async (req, res) => {
    try {
        const user = await User.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(req.user._id)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "watchHistory",
                    foreignField: "_id",
                    as: "watchHistory",
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                pipeline: [
                                    {
                                        $project: {
                                            fullName: 1,
                                            username: 1,
                                            avatar: 1,
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields: {
                                owner: {
                                    $first: "$owner"
                                }
                            }
                        }
                    ]
                }
            }
        ])
    
        res.status(200).json({watchHistory: user[0].watchHistory, message: "watch history fetched successfully"});
    } catch (error) {
        res.status(400).json({message: "Error in getWatchHistory", error: error.message});
    }
} 